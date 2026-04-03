{
  pkgs,
  src,
  pnpmDeps,
}:
pkgs.stdenv.mkDerivation {
  pname = "eulesia-frontend";
  version = "0.0.0";
  inherit src pnpmDeps;

  nativeBuildInputs = with pkgs; [
    nodejs_22
    pnpm_10
    pnpmConfigHook
  ];

  buildPhase = ''
    runHook preBuild
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
