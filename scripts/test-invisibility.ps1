# End-to-end invisibility test on this PC.
# Starts Hintlyx in capture-test mode (it draws a magenta block), captures the screen with
# DXGI, Windows Graphics Capture, getDisplayMedia and GDI, and counts magenta pixels.
# Visible: every method must see the block. Invisible: no method may see it,
# including after a hide/show cycle. Restores your invisibility setting at the end.
# Usage: npm run build; powershell -File scripts/test-invisibility.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$electron = Join-Path $root 'node_modules\electron\dist\electron.exe'
$prefsPath = Join-Path $env:APPDATA 'hintlyx\prefs.json'
$original = if (Test-Path $prefsPath) { Get-Content $prefsPath -Raw } else { $null }
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -ReferencedAssemblies System.Drawing @'
using System;
using System.Runtime.InteropServices;
public static class HxCursor {
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [StructLayout(LayoutKind.Sequential)] public struct CURSORINFO { public int cbSize; public int flags; public IntPtr hCursor; public POINT pt; }
  [DllImport("user32.dll")] public static extern bool GetCursorInfo(ref CURSORINFO ci);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  // Real mouse input (like a physical mouse). SetCursorPos alone does not create input events.
  [DllImport("user32.dll")] public static extern void mouse_event(int flags, int dx, int dy, int data, IntPtr extra);
  public static void Nudge(int dx) { mouse_event(0x0001, dx, 0, 0, IntPtr.Zero); }
  [DllImport("user32.dll")] public static extern bool DrawIconEx(IntPtr hdc, int x, int y, IntPtr icon, int w, int h, int step, IntPtr brush, int flags);
  public static string Last = "";
  /// Screen-share apps draw the pointer from this. It counts as drawn only if Windows shows a
  /// pointer AND its image has visible pixels (a blank pointer image draws nothing).
  public static bool PointerDrawn() {
    var ci = new CURSORINFO(); ci.cbSize = Marshal.SizeOf(ci);
    GetCursorInfo(ref ci);
    if ((ci.flags & 1) == 0 || ci.hCursor == IntPtr.Zero) { Last = "no pointer"; return false; }
    int visible = 0;
    foreach (var bg in new[] { System.Drawing.Color.White, System.Drawing.Color.Black }) {
      using (var bmp = new System.Drawing.Bitmap(64, 64))
      using (var g = System.Drawing.Graphics.FromImage(bmp)) {
        g.Clear(bg);
        var hdc = g.GetHdc(); DrawIconEx(hdc, 0, 0, ci.hCursor, 0, 0, 0, IntPtr.Zero, 3); g.ReleaseHdc(hdc);
        for (int y = 0; y < 64; y++) for (int x = 0; x < 64; x++) if (bmp.GetPixel(x, y).ToArgb() != bg.ToArgb()) visible++;
      }
    }
    Last = "handle " + ci.hCursor + ", visible pixels " + visible;
    return visible > 0;
  }
}
'@

function Get-HintlyxProcs { Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $electron } }

function Stop-Hintlyx {
  Get-HintlyxProcs | Stop-Process -Force -ErrorAction SilentlyContinue
  # Wait until every process is gone, or the single-instance lock keeps the old window alive.
  $deadline = (Get-Date).AddSeconds(10)
  while ((Get-HintlyxProcs) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 200 }
  if (Get-HintlyxProcs) { throw 'Hintlyx did not exit' }
  Start-Sleep -Milliseconds 500
}

function Start-Hintlyx([bool]$invisible) {
  Stop-Hintlyx
  New-Item -ItemType Directory -Force (Split-Path $prefsPath) | Out-Null
  $json = '{"invisible":' + $invisible.ToString().ToLower() + ',"hideFromTaskbar":false}'
  [IO.File]::WriteAllText($prefsPath, $json)
  $env:HINTLYX_CAPTURE_TEST = '1'
  Start-Process -FilePath $electron -ArgumentList "`"$root`"" -WindowStyle Hidden | Out-Null
  Remove-Item Env:HINTLYX_CAPTURE_TEST
  Start-Sleep -Seconds 5
}

function Get-GdiMagenta {
  $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($b.X, $b.Y, 0, 0, $bmp.Size)
  $g.Dispose()
  $rect = New-Object System.Drawing.Rectangle 0, 0, $bmp.Width, $bmp.Height
  $data = $bmp.LockBits($rect, 'ReadOnly', 'Format32bppArgb')
  $bytes = New-Object byte[] ($data.Stride * $data.Height)
  [Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $bmp.UnlockBits($data); $bmp.Dispose()
  $n = 0
  for ($i = 0; $i -lt $bytes.Length; $i += 4) {
    if ($bytes[$i + 2] -gt 220 -and $bytes[$i + 1] -lt 60 -and $bytes[$i] -gt 220) { $n++ }
  }
  return $n
}

function Get-Captures {
  $result = [ordered]@{ gdi = Get-GdiMagenta }
  foreach ($wgc in '0', '1') {
    $env:CAPTURE_WGC = $wgc
    $line = & $electron (Join-Path $root 'scripts\capture-check.cjs') 2>$null | Where-Object { $_ -like 'CAPTURE_RESULT*' } | Select-Object -First 1
    Remove-Item Env:CAPTURE_WGC
    if ($line) {
      ($line -replace '^CAPTURE_RESULT ', '' | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $result[$_.Name] = $_.Value }
    }
  }
  return $result
}

function Test-Case([string]$name, $captures, [bool]$expectVisible) {
  $ok = $true
  foreach ($k in $captures.Keys) {
    $v = $captures[$k]
    if ($v -isnot [int] -and $v -isnot [long]) { $pass = $false }
    elseif ($expectVisible) { $pass = $v -gt 1000 } else { $pass = $v -eq 0 }
    if (-not $pass) { $ok = $false }
    Write-Host ('{0,-6} {1,-28} {2,-28} {3}' -f ($(if ($pass) { 'PASS' } else { 'FAIL' })), $name, $k, $v)
  }
  return $ok
}

# Moves the mouse onto the command bar and asks Windows whether a pointer is drawn there.
function Test-Pointer([string]$name, [bool]$expectDrawn) {
  $b = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  $x = [int]($b.X + $b.Width / 2); $y = $b.Y + 38
  $drawn = $null
  [HxCursor]::SetCursorPos($x, $y) | Out-Null
  foreach ($i in 1..6) {
    [HxCursor]::Nudge($(if ($i % 2) { 1 } else { -1 }))
    Start-Sleep -Milliseconds 250
    $drawn = [HxCursor]::PointerDrawn()
  }
  $pass = $drawn -eq $expectDrawn
  Write-Host ('{0,-6} {1,-28} {2,-28} {3}' -f ($(if ($pass) { 'PASS' } else { 'FAIL' })), $name, 'pointer over Hintlyx', "$(if ($drawn) { 'drawn' } else { 'hidden' }) ($([HxCursor]::Last))")
  return $pass
}

$startPos = New-Object HxCursor+POINT
[HxCursor]::GetCursorPos([ref]$startPos) | Out-Null

$allOk = $true
try {
  Start-Hintlyx $false
  $allOk = (Test-Case 'visible (control)' (Get-Captures) $true) -and $allOk
  $allOk = (Test-Pointer 'visible (control)' $true) -and $allOk

  Start-Hintlyx $true
  $allOk = (Test-Case 'invisible' (Get-Captures) $false) -and $allOk
  $allOk = (Test-Pointer 'invisible' $false) -and $allOk

  # Hide and show again with the Ctrl+\ hotkey, then re-check.
  [System.Windows.Forms.SendKeys]::SendWait('^\'); Start-Sleep -Milliseconds 700
  [System.Windows.Forms.SendKeys]::SendWait('^\'); Start-Sleep -Milliseconds 1200
  $allOk = (Test-Case 'invisible after hide/show' (Get-Captures) $false) -and $allOk
}
finally {
  [HxCursor]::SetCursorPos($startPos.X, $startPos.Y) | Out-Null
  Stop-Hintlyx
  if ($null -ne $original) { [IO.File]::WriteAllText($prefsPath, $original) } else { Remove-Item $prefsPath -ErrorAction SilentlyContinue }
}

if ($allOk) { 'RESULT: ALL PASSED'; exit 0 } else { 'RESULT: FAILED'; exit 1 }
