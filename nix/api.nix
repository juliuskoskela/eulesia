{ pkgs, src }:

pkgs.buildNpmPackage {
  pname = "eulesia-api";
  version = "1.0.0";
  inherit src;

  nodejs = pkgs.nodejs_20;
  npmDepsHash = "sha256-mIwet1hnMOylUAfYZjJRRfT5UBr57VmqWetyB+sv1w0=";
  npmWorkspace = "apps/api";
  makeCacheWritable = true;
  npmRebuildFlags = [ "--ignore-scripts" ];

  nativeBuildInputs = with pkgs; [
    python3
    pkg-config
  ];

  buildInputs = with pkgs; [
    vips
    libargon2
  ];

  npmBuildScript = "build";

  installPhase = ''
    runHook preInstall

    mkdir -p $out/share/eulesia-api
    cp -r apps/api/dist $out/share/eulesia-api/dist
    cp -r node_modules $out/share/eulesia-api/node_modules
    rm -f $out/share/eulesia-api/node_modules/@eulesia/api
    cp apps/api/package.json $out/share/eulesia-api/package.json

    mkdir -p $out/bin
    cat > $out/bin/eulesia-api <<EOF
    #!${pkgs.runtimeShell}
    set -euo pipefail
    exec ${pkgs.nodejs_20}/bin/node $out/share/eulesia-api/dist/index.js "\$@"
    EOF
    chmod +x $out/bin/eulesia-api

    runHook postInstall
  '';
}
