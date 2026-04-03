{inputs, ...}: {
  perSystem = {
    config,
    lib,
    pkgs,
    system,
    ...
  }: let
    repoSrc = pkgs.lib.cleanSource ../../.;
    pnpmDeps = config.packages.pnpmDeps;
    nativeBuildInputs = with pkgs; [
      nodejs_22
      pnpm_10
      pnpmConfigHook
      python3
      pkg-config
    ];
    buildInputs = with pkgs; [
      vips
      libargon2
    ];

    mkFrontendCheck = name: script:
      pkgs.stdenv.mkDerivation {
        pname = name;
        version = "1.0.0";
        src = repoSrc;
        inherit nativeBuildInputs buildInputs pnpmDeps;
        buildPhase = ''
          runHook preBuild
          pnpm run ${script}
          runHook postBuild
        '';
        installPhase = ''
          mkdir -p $out
        '';
      };

    mkApiCheck = name: script:
      pkgs.stdenv.mkDerivation {
        pname = name;
        version = "1.0.0";
        src = repoSrc;
        inherit nativeBuildInputs buildInputs pnpmDeps;
        buildPhase = ''
          runHook preBuild
          pnpm --filter @eulesia/api run ${script}
          runHook postBuild
        '';
        installPhase = ''
          mkdir -p $out
        '';
      };

    formatCheck =
      pkgs.runCommand "eulesia-format-check" {
        nativeBuildInputs = [config.treefmt.build.wrapper];
      } ''
        cd ${repoSrc}
        export HOME="$TMPDIR"
        export XDG_CACHE_HOME="$TMPDIR/.cache"
        mkdir -p "$XDG_CACHE_HOME"
        treefmt --fail-on-change
        touch $out
      '';

    nixLintCheck =
      pkgs.runCommand "eulesia-nix-lint-check" {
        nativeBuildInputs = with pkgs; [statix deadnix];
      } ''
        cd ${repoSrc}
        statix check flake.nix
        statix check nix
        deadnix --fail flake.nix nix
        touch $out
      '';
  in {
    checks =
      {
        format = formatCheck;
        nix-lint = nixLintCheck;
        frontend-lint = mkFrontendCheck "eulesia-frontend-lint-check" "check:web";
        api-lint = mkApiCheck "eulesia-api-lint-check" "check";
        frontend-test = mkFrontendCheck "eulesia-frontend-test-check" "test:web:run";
        api-test = mkApiCheck "eulesia-api-test-check" "test:run";
        frontend-build = config.packages.frontend;
        api-build = config.packages.api;
      }
      // lib.optionalAttrs (system == "x86_64-linux") {
        vm-build = inputs.self.nixosConfigurations.eulesia-vm.config.microvm.runner.qemu;
        test-host-build = inputs.self.nixosConfigurations.eulesia-test.config.system.build.toplevel;
      };
  };
}
