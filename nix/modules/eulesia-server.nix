{
  config,
  lib,
  pkgs,
  ...
}:
with lib; let
  cfg = config.services.eulesia-server;
in {
  options.services.eulesia-server = {
    enable = mkEnableOption "Eulesia v2 Rust server";

    package = mkOption {
      type = types.package;
      description = "The eulesia-server package to use.";
    };

    user = mkOption {
      type = types.str;
      default = config.services.eulesia.user or "eulesia";
      description = "User to run the server as (defaults to eulesia user).";
    };

    group = mkOption {
      type = types.str;
      default = config.services.eulesia.group or "eulesia";
      description = "Group to run the server as.";
    };

    host = mkOption {
      type = types.str;
      default = "127.0.0.1";
      description = "Address to bind to.";
    };

    port = mkOption {
      type = types.port;
      default = 3002;
      description = "Port to listen on.";
    };

    logLevel = mkOption {
      type = types.str;
      default = "info";
      description = "Log level (trace, debug, info, warn, error).";
    };

    logJson = mkOption {
      type = types.bool;
      default = true;
      description = "Output logs as JSON.";
    };
  };

  config = mkIf cfg.enable {
    systemd.services.eulesia-server = {
      description = "Eulesia v2 API Server";
      wantedBy = ["multi-user.target"];
      wants = ["network-online.target"];
      after = ["network-online.target"];

      environment = {
        EULESIA_HOST = cfg.host;
        EULESIA_PORT = toString cfg.port;
        EULESIA_LOG_LEVEL = cfg.logLevel;
        EULESIA_LOG_JSON =
          if cfg.logJson
          then "true"
          else "";
      };

      serviceConfig = {
        Type = "simple";
        User = cfg.user;
        Group = cfg.group;
        ExecStart = "${cfg.package}/bin/eulesia-server";
        Restart = "on-failure";
        RestartSec = 5;
      };
    };
  };
}
