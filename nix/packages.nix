{inputs, ...}: {
  perSystem = {pkgs, ...}: let
    repoSrc = pkgs.lib.cleanSource ../.;
    generateIduraJwks = import ./generate-idura-jwks.nix {inherit pkgs;};

    # JS/pnpm builds
    pnpmDeps = pkgs.fetchPnpmDeps {
      pname = "eulesia";
      src = repoSrc;
      hash = "sha256-jG+DetPZvkeLZCnBLO3SNeTmWOu2Ual0xgsvukimY9U=";
      fetcherVersion = 3;
    };

    frontend = import ./frontend.nix {
      inherit pkgs pnpmDeps;
      src = repoSrc;
    };
    api = import ./api.nix {
      inherit pkgs pnpmDeps;
      src = repoSrc;
    };
    fullBuild = pkgs.runCommand "eulesia-build" {} ''
      mkdir -p $out
      ln -s ${frontend} $out/frontend
      ln -s ${api} $out/api
      ln -s ${server} $out/server
    '';

    # Rust builds
    craneLib = (inputs.crane.mkLib pkgs).overrideToolchain (
      p: p.rust-bin.stable.latest.default
    );

    rustBuilds = import ./server.nix {
      inherit pkgs craneLib;
      src = repoSrc;
    };
    server = rustBuilds.package;
  in {
    packages = {
      inherit frontend api server pnpmDeps;
      build = fullBuild;
      generate-idura-jwks = generateIduraJwks;
      default = fullBuild;
    };

    checks = {
      server-clippy = rustBuilds.clippy;
      server-test = rustBuilds.test;
      # server-fmt removed — treefmt handles Rust formatting via the format check.
    };

    apps = {
      api = {
        type = "app";
        program = "${api}/bin/eulesia-api";
        meta.description = "Run the packaged Eulesia API server";
      };
      server = {
        type = "app";
        program = "${server}/bin/eulesia-server";
        meta.description = "Run the Eulesia v2 Rust server";
      };
      generate-idura-jwks = {
        type = "app";
        program = "${generateIduraJwks}/bin/generate-idura-jwks";
        meta.description = "Generate FTN-compliant Idura client keys and public JWKS";
      };
      default = {
        type = "app";
        program = "${api}/bin/eulesia-api";
        meta.description = "Run the packaged Eulesia API server";
      };
    };
  };
}
