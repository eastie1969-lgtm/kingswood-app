$ErrorActionPreference = "Stop"

$hubDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$proofingDir = Resolve-Path (Join-Path $hubDir "..\Proofing report builder")
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $hubDir "backups\proofing-builder-$stamp"

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$appPath = Join-Path $proofingDir "app.py"
$cssPath = Join-Path $proofingDir "static\app.css"
$jsPath = Join-Path $proofingDir "static\app.js"

Copy-Item $appPath (Join-Path $backupDir "app.py")
Copy-Item $cssPath (Join-Path $backupDir "app.css")
Copy-Item $jsPath (Join-Path $backupDir "app.js")

$app = Get-Content $appPath -Raw
$app = $app.Replace('REPORT_DIR = BASE_DIR / "generated_reports"', 'REPORT_DIR = Path(os.getenv("REPORT_DIR", BASE_DIR / "generated_reports"))')
$app = $app.Replace('REPORT_DIR.mkdir(exist_ok=True)', 'REPORT_DIR.mkdir(parents=True, exist_ok=True)')
Set-Content -Path $appPath -Value $app -NoNewline

$css = Get-Content $cssPath -Raw
$css = $css.Replace('--ink: #17191f;', '--ink: #071225;')
$css = $css.Replace('--muted: #667085;', '--muted: #516176;')
$css = $css.Replace('--line: #d7dbe3;', '--line: #d7e3eb;')
$css = $css.Replace('--panel: #fff;', '--panel: #ffffff;')
$css = $css.Replace('--page: #eef1f5;', '--page: #eef6f6;')
$css = $css.Replace('--navy: #070746;', '--navy: #071225;')
$css = $css.Replace('--navy-soft: #11145e;', '--navy-soft: #13284d;')
$css = $css.Replace('--silver: #d9dde4;', '--silver: #dbe7f2;')
$css = $css.Replace('--accent: #070746;', '--accent: #31c1ad;')
$css = $css.Replace('--accent-dark: #030326;', '--accent-dark: #0f766e;')
$css = $css.Replace('--shadow: 0 18px 45px rgba(7, 7, 70, .10);', '--shadow: 0 18px 45px rgba(7, 18, 37, .12);')
$css = $css.Replace('linear-gradient(180deg, #070746 0, #070746 220px, var(--page) 220px);', 'linear-gradient(180deg, #071225 0, #13284d 220px, var(--page) 220px);')
$css = $css.Replace('outline: 2px solid rgba(7, 7, 70, .16);', 'outline: 2px solid rgba(49, 193, 173, .18);')
$css = $css.Replace('border-color: var(--navy);', 'border-color: var(--accent);')
$css = $css.Replace('background: var(--navy);', 'background: var(--accent);')
$css = $css.Replace('background: var(--navy-soft);', 'background: var(--accent-dark);')
Set-Content -Path $cssPath -Value $css -NoNewline

$js = Get-Content $jsPath -Raw
$js = $js.Replace('generateButton.textContent = "Generate PDF";', 'generateButton.textContent = "Generate & Save PDF";')
$js = $js.Replace('link.download = "Pest_Proofing_Report.pdf";', 'link.download = "Pest_Proofing_Report.pdf";' + "`r`n    alert(`"PDF saved to the Kingswood Field Reports OneDrive folder and downloaded to this computer.`");')
Set-Content -Path $jsPath -Value $js -NoNewline

Write-Host "Proofing Builder updated."
Write-Host "Backup saved to: $backupDir"
Read-Host "Press Enter to close"
