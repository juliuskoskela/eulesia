{
  pkgs,
  craneLib,
  src,
}: let
  commonArgs = {
    inherit src;
    pname = "eulesia-server";
    version = "0.1.0";
    strictDeps = true;
  };

  cargoArtifacts = craneLib.buildDepsOnly commonArgs;
in {
  package = craneLib.buildPackage (commonArgs
    // {
      inherit cargoArtifacts;
    });

  clippy = craneLib.cargoClippy (commonArgs
    // {
      inherit cargoArtifacts;
      cargoClippyExtraArgs = "--all-targets -- --deny warnings";
    });

  test = craneLib.cargoTest (commonArgs
    // {
      inherit cargoArtifacts;
    });

  fmt = craneLib.cargoFmt {
    inherit src;
    pname = "eulesia-server";
    version = "0.1.0";
  };
}
