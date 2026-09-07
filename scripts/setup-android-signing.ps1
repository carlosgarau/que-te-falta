param(
    [string]$Repository = "carlosgarau/que-te-falta"
)

$ErrorActionPreference = "Stop"

$jdkRoot = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot "..\.tools\jdk21") -Directory |
    Select-Object -First 1
if (-not $jdkRoot) {
    throw "No se encuentra el JDK portátil en .tools/jdk21."
}

$keytool = Join-Path $jdkRoot.FullName "bin\keytool.exe"
if (-not (Test-Path -LiteralPath $keytool)) {
    throw "No se encuentra keytool en el JDK portátil."
}

$secretRoot = Join-Path $env:USERPROFILE ".codex\secrets\que-te-falta"
New-Item -ItemType Directory -Force -Path $secretRoot | Out-Null
$keystorePath = Join-Path $secretRoot "android-upload.jks"
$passwordBackupPath = Join-Path $secretRoot "android-upload-password.dpapi"
$alias = "que-te-falta-upload"

if (Test-Path -LiteralPath $keystorePath) {
    throw "Ya existe una clave Android en $keystorePath. No se sobrescribirá."
}

$passwordBytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($passwordBytes)
$password = [Convert]::ToBase64String($passwordBytes).TrimEnd("=").Replace("+", "A").Replace("/", "B")

& $keytool -genkeypair `
    -keystore $keystorePath `
    -storetype JKS `
    -storepass $password `
    -keypass $password `
    -alias $alias `
    -keyalg RSA `
    -keysize 4096 `
    -validity 10000 `
    -dname "CN=Que te falta Upload, OU=Mobile, O=Que te falta, L=Palma, ST=Illes Balears, C=ES"

if ($LASTEXITCODE -ne 0) {
    throw "keytool no pudo crear la clave de subida."
}

$securePassword = ConvertTo-SecureString $password -AsPlainText -Force
$encryptedPassword = ConvertFrom-SecureString $securePassword
[System.IO.File]::WriteAllText($passwordBackupPath, $encryptedPassword, [System.Text.Encoding]::UTF8)

$keystoreBase64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($keystorePath))
$keystoreBase64 | gh secret set ANDROID_UPLOAD_KEYSTORE_BASE64 --repo $Repository
$password | gh secret set ANDROID_UPLOAD_KEYSTORE_PASSWORD --repo $Repository
$alias | gh secret set ANDROID_UPLOAD_KEY_ALIAS --repo $Repository
$password | gh secret set ANDROID_UPLOAD_KEY_PASSWORD --repo $Repository

if ($LASTEXITCODE -ne 0) {
    throw "No se pudieron guardar todos los secretos de firma en GitHub."
}

$certificatePath = Join-Path $secretRoot "android-upload-certificate.pem"
& $keytool -exportcert -rfc `
    -keystore $keystorePath `
    -storepass $password `
    -alias $alias `
    -file $certificatePath

if ($LASTEXITCODE -ne 0) {
    throw "No se pudo exportar el certificado público."
}

Write-Output "ANDROID_SIGNING_READY"
Write-Output "Keystore: $keystorePath"
Write-Output "Certificado público: $certificatePath"
Write-Output "Contraseña cifrada para este usuario de Windows: $passwordBackupPath"
