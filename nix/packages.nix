_: {
  perSystem = {pkgs, ...}: let
    repoSrc = pkgs.lib.cleanSource ../.;
    generateIduraJwks = import ./generate-idura-jwks.nix {inherit pkgs;};
    frontend = import ./frontend.nix {
      inherit pkgs;
      src = repoSrc;
    };
    api = import ./api.nix {
      inherit pkgs;
      src = repoSrc;
    };
    fullBuild = pkgs.runCommand "eulesia-build" {} ''
      mkdir -p $out
      ln -s ${frontend} $out/frontend
      ln -s ${api} $out/api
    '';
  in {
    packages = {
      inherit frontend api;
      build = fullBuild;
      generate-idura-jwks = generateIduraJwks;
      default = fullBuild;
    };

    apps = {
      api = {
        type = "app";
        program = "${api}/bin/eulesia-api";
      };
      generate-idura-jwks = {
        type = "app";
        program = "${generateIduraJwks}/bin/generate-idura-jwks";
      };
      default = {
        type = "app";
        program = "${api}/bin/eulesia-api";
      };
    };
  };
}
