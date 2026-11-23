# Generates the Hintlyx icon (unique "H" monogram with a spark on a gradient tile)
# into resources/icon.png (1024) and resources/icon.ico (multi-size). Reproducible: just rerun.
Add-Type -AssemblyName System.Drawing
$dir = $PSScriptRoot

function New-Icon([int]$S) {
  $k = $S / 256.0
  $bmp = New-Object System.Drawing.Bitmap $S, $S
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)

  function RR($x, $y, $w, $h, $r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath; $d = $r * 2
    $p.AddArc($x, $y, $d, $d, 180, 90); $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $p.CloseFigure(); $p
  }

  # Rounded tile with a diagonal blue-to-indigo gradient.
  $tile = RR (8 * $k) (8 * $k) (240 * $k) (240 * $k) (56 * $k)
  $rect = New-Object System.Drawing.Rectangle 0, 0, $S, $S
  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(255, 37, 99, 235)), ([System.Drawing.Color]::FromArgb(255, 99, 102, 241)), 45.0
  $g.FillPath($grad, $tile)

  # "H" monogram, built from three rounded bars, filled white.
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $g.FillPath($white, (RR (74 * $k) (72 * $k) (30 * $k) (112 * $k) (12 * $k)))   # left leg
  $g.FillPath($white, (RR (152 * $k) (72 * $k) (30 * $k) (112 * $k) (12 * $k)))  # right leg
  $g.FillPath($white, (RR (74 * $k) (113 * $k) (108 * $k) (28 * $k) (12 * $k)))  # crossbar

  # Spark (four-point star) at the top-right, suggesting insight.
  $cx = 190 * $k; $cy = 64 * $k; $a = 26 * $k; $b = 8 * $k
  $star = New-Object System.Drawing.Drawing2D.GraphicsPath
  $star.AddPolygon(@(
      (New-Object System.Drawing.PointF $cx, ($cy - $a)),
      (New-Object System.Drawing.PointF ($cx + $b), ($cy - $b)),
      (New-Object System.Drawing.PointF ($cx + $a), $cy),
      (New-Object System.Drawing.PointF ($cx + $b), ($cy + $b)),
      (New-Object System.Drawing.PointF $cx, ($cy + $a)),
      (New-Object System.Drawing.PointF ($cx - $b), ($cy + $b)),
      (New-Object System.Drawing.PointF ($cx - $a), $cy),
      (New-Object System.Drawing.PointF ($cx - $b), ($cy - $b))
    ))
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 186, 230, 253))), $star)

  $g.Dispose()
  return $bmp
}

# 1024 PNG for macOS/Linux and the website.
$png = New-Icon 1024
$png.Save((Join-Path $dir 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$png.Dispose()

# Multi-size ICO for Windows (each entry is a PNG, valid on modern Windows).
$sizes = 16, 32, 48, 64, 128, 256
$streams = @()
foreach ($s in $sizes) {
  $b = New-Icon $s
  $ms = New-Object System.IO.MemoryStream
  $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $b.Dispose()
  $streams += , $ms.ToArray()
}
$out = [IO.File]::Open((Join-Path $dir 'icon.ico'), 'Create')
$bw = New-Object IO.BinaryWriter $out
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $dim = if ($sizes[$i] -ge 256) { 0 } else { $sizes[$i] }
  $bw.Write([Byte]$dim); $bw.Write([Byte]$dim); $bw.Write([Byte]0); $bw.Write([Byte]0)
  $bw.Write([UInt16]1); $bw.Write([UInt16]32)
  $bw.Write([UInt32]$streams[$i].Length); $bw.Write([UInt32]$offset)
  $offset += $streams[$i].Length
}
foreach ($data in $streams) { $bw.Write($data) }
$bw.Flush(); $out.Close()
"icon.png and icon.ico ($($sizes.Count) sizes) written to $dir"
