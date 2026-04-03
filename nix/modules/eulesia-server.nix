{
  config,
  lib,
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

    database = {
      createLocally = mkOption {
        type = types.bool;
        default = true;
        description = "Provision a PostgreSQL database locally for the v2 server.";
      };

      name = mkOption {
        type = types.str;
        default = "eulesia_v2";
        description = "Database name for the v2 server.";
      };

      url = mkOption {
        type = types.str;
        default = "postgresql:///${cfg.database.name}";
        description = "Database connection string.";
      };
    };

    frontendOrigin = mkOption {
      type = types.str;
      default = "https://${config.services.eulesia.appDomain or "localhost"}";
      description = "Frontend origin for CORS.";
    };

    cookieDomain = mkOption {
      type = types.nullOr types.str;
      default = config.services.eulesia.auth.cookieDomain or null;
      description = "Cookie domain for session cookies.";
    };

    cookieSecure = mkOption {
      type = types.bool;
      default = true;
      description = "Set Secure flag on session cookies.";
    };
  };

  config = mkIf cfg.enable {
    assertions = [
      {
        assertion = !(cfg.database.createLocally && cfg.user != (config.services.eulesia.user or "eulesia"));
        message = "Local PostgreSQL expects eulesia-server user to match for peer auth.";
      }
    ];

    services.postgresql = mkIf cfg.database.createLocally {
      enable = true;
      ensureDatabases = [cfg.database.name];
      ensureUsers = [
        {
          name = cfg.user;
          ensureDBOwnership = true;
        }
      ];
    };

    # Pre-create citext extension (requires superuser) and grant schema
    # access to the application user.
    systemd.services.eulesia-server-db-setup = mkIf cfg.database.createLocally {
      description = "Eulesia v2 database setup (extensions + permissions)";
      wantedBy = ["multi-user.target"];
      after = ["postgresql.service"];
      requires = ["postgresql.service"];
      serviceConfig = {
        Type = "oneshot";
        RemainAfterExit = true;
        User = "postgres";
      };
      script = ''
        psql -d ${cfg.database.name} -c "CREATE EXTENSION IF NOT EXISTS citext;"
        psql -d ${cfg.database.name} -c "GRANT ALL ON SCHEMA public TO ${cfg.user};"
      '';
    };

    systemd.services.eulesia-server = {
      description = "Eulesia v2 API Server";
      wantedBy = ["multi-user.target"];
      wants = ["network-online.target"];
      after =
        ["network-online.target"]
        ++ optional cfg.database.createLocally "eulesia-server-db-setup.service";
      requires =
        optional cfg.database.createLocally "eulesia-server-db-setup.service";

      environment =
        {
          DATABASE_URL = cfg.database.url;
          EULESIA_HOST = cfg.host;
          EULESIA_PORT = toString cfg.port;
          EULESIA_LOG_LEVEL = cfg.logLevel;
          EULESIA_LOG_JSON =
            if cfg.logJson
            then "true"
            else "";
          EULESIA_FRONTEND_ORIGIN = cfg.frontendOrigin;
          EULESIA_COOKIE_SECURE =
            if cfg.cookieSecure
            then "true"
            else "";
        }
        // optionalAttrs (cfg.cookieDomain != null) {
          EULESIA_COOKIE_DOMAIN = cfg.cookieDomain;
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
