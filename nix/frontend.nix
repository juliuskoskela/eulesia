{
  pkgs,
  src,
}:
pkgs.buildNpmPackage {
  pname = "eulesia-frontend";
  version = "0.0.0";
  inherit src;

  nodejs = pkgs.nodejs_22;
  npmDepsHash = "sha256-mIwet1hnMOylUAfYZjJRRfT5UBr57VmqWetyB+sv1w0=";
  makeCacheWritable = true;
  npmRebuildFlags = ["--ignore-scripts"];

  npmBuildScript = "build";

  installPhase = ''
    runHook preInstall
    mkdir -p $out
    cp -r dist/* $out/
    runHook postInstall
  '';
}
