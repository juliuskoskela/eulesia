{
  pkgs,
  src,
}:
pkgs.buildNpmPackage {
  pname = "eulesia-frontend";
  version = "0.0.0";
  inherit src;

  nodejs = pkgs.nodejs_22;
  npmDepsHash = "sha256-y3LBC+9reH+R9ZxPH1jtZT7ltF2dW9YREoIZt3KwF7k=";
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
