{
  pkgs,
  src,
  pnpmDeps,
  pwaMode ? "enabled",
}:
pkgs.stdenv.mkDerivation {
  pname =
    if pwaMode == "enabled"
    then "eulesia-frontend"
    else "eulesia-frontend-${pwaMode}";
  version = "0.0.0";
  inherit src pnpmDeps;

  nativeBuildInputs = with pkgs; [
    nodejs_22
    pnpm_10
    pnpmConfigHook
  ];

  buildPhase = ''
    runHook preBuild
    export EULESIA_PWA_MODE="${pwaMode}"
    pnpm --filter @eulesia/web run build
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p $out
    cp -r apps/web/dist/* $out/
    runHook postInstall
  '';
}
