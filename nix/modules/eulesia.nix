{
  config,
  lib,
  ...
}:
with lib; let
  cfg = config.services.eulesia;
  urlScheme =
    if cfg.tls.enable
    then "https"
    else "http";
  appUrl = "${urlScheme}://${cfg.appDomain}";
  apiUrl = "${urlScheme}://${cfg.apiDomain}";
  apiProxy = "http://${cfg.api.listenAddress}:${toString cfg.api.port}";
  ogBotRegex = "(facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|Slackbot|Discordbot|TelegramBot|Embedly|Pinterest|vkShare|Applebot|Googlebot|bingbot|Baiduspider|YandexBot|DuckDuckBot)";

  fileEnv = name: path:
    optionalString (path != null) ''
      export ${name}="$(cat ${escapeShellArg (toString path)})"
    '';

  stringEnv = name: value: ''
    export ${name}=${escapeShellArg value}
  '';

  extraEnvironment = concatStringsSep "\n" (
    mapAttrsToList stringEnv cfg.extraEnvironment
  );

  extraSecretEnvironment = concatStringsSep "\n" (
    mapAttrsToList fileEnv cfg.extraSecretEnvironmentFiles
  );

  apiEnvironment = ''
    ${stringEnv "NODE_ENV" "production"}
    ${stringEnv "PORT" (toString cfg.api.port)}
    ${stringEnv "DATABASE_URL" cfg.database.url}
    ${stringEnv "APP_URL" appUrl}
    ${stringEnv "API_URL" apiUrl}
    ${stringEnv "EMAIL_PROVIDER" cfg.email.provider}
    ${stringEnv "EMAIL_FROM" cfg.email.from}
    ${stringEnv "MEILI_URL" cfg.meilisearch.url}
    ${stringEnv "MISTRAL_MODEL" cfg.ai.mistralModel}
    ${stringEnv "UPLOAD_DIR" cfg.uploadsDir}
    ${stringEnv "ALLOWED_ORIGINS" (concatStringsSep "," cfg.auth.nativeOrigins)}
    ${optionalString (cfg.auth.cookieDomain != null) (stringEnv "COOKIE_DOMAIN" cfg.auth.cookieDomain)}
    ${optionalString (cfg.email.smtp.host != null) (stringEnv "SMTP_HOST" cfg.email.smtp.host)}
    ${stringEnv "SMTP_PORT" (toString cfg.email.smtp.port)}
    ${stringEnv "SMTP_SECURE" (
      if cfg.email.smtp.secure
      then "true"
      else "false"
    )}
    ${fileEnv "SESSION_SECRET" cfg.auth.sessionSecretFile}
    ${fileEnv "MEILI_MASTER_KEY" cfg.meilisearch.masterKeyFile}
    ${fileEnv "SMTP_USER" cfg.email.smtp.userFile}
    ${fileEnv "SMTP_PASS" cfg.email.smtp.passFile}
    ${fileEnv "MISTRAL_API_KEY" cfg.ai.mistralApiKeyFile}
    ${fileEnv "VAPID_PUBLIC_KEY" cfg.push.vapidPublicKeyFile}
    ${fileEnv "VAPID_PRIVATE_KEY" cfg.push.vapidPrivateKeyFile}
    ${stringEnv "VAPID_SUBJECT" cfg.push.vapidSubject}
    ${fileEnv "FIREBASE_SERVICE_ACCOUNT_KEY" cfg.push.firebaseServiceAccountKeyFile}
    ${extraEnvironment}
    ${extraSecretEnvironment}
  '';
in {
  options.services.eulesia = {
    enable = mkEnableOption "Eulesia civic platform";

    package = mkOption {
      type = types.nullOr types.package;
      default = null;
      description = "Packaged Eulesia API derivation.";
    };

    frontendPackage = mkOption {
      type = types.nullOr types.package;
      default = null;
      description = "Packaged Eulesia frontend derivation.";
    };

    user = mkOption {
      type = types.str;
      default = "eulesia";
      description = "System user used to run the Eulesia API.";
    };

    group = mkOption {
      type = types.str;
      default = "eulesia";
      description = "System group used to run the Eulesia API.";
    };

    stateDir = mkOption {
      type = types.str;
      default = "/var/lib/eulesia";
      description = "Persistent application state directory.";
    };

    uploadsDir = mkOption {
      type = types.str;
      default = "${cfg.stateDir}/uploads";
      description = "Directory for user-uploaded files.";
    };

    appDomain = mkOption {
      type = types.str;
      default = "eulesia.eu";
      description = "Primary web domain.";
    };

    apiDomain = mkOption {
      type = types.str;
      default = "api.eulesia.eu";
      description = "API domain.";
    };

    api = {
      listenAddress = mkOption {
        type = types.str;
        default = "127.0.0.1";
        description = "Bind address for the API service.";
      };

      port = mkOption {
        type = types.port;
        default = 3001;
        description = "Port for the API service.";
      };
    };

    database = {
      createLocally = mkOption {
        type = types.bool;
        default = true;
        description = "Provision PostgreSQL locally on the host.";
      };

      name = mkOption {
        type = types.str;
        default = "eulesia";
        description = "Database name when PostgreSQL is managed locally.";
      };

      user = mkOption {
        type = types.str;
        default = "eulesia";
        description = "Database user when PostgreSQL is managed locally.";
      };

      url = mkOption {
        type = types.str;
        default = "postgresql://eulesia@/eulesia?host=/run/postgresql";
        description = "Database connection string passed to the API.";
      };
    };

    meilisearch = {
      createLocally = mkOption {
        type = types.bool;
        default = true;
        description = "Provision Meilisearch locally on the host.";
      };

      listenAddress = mkOption {
        type = types.str;
        default = "127.0.0.1";
        description = "Bind address for locally managed Meilisearch.";
      };

      listenPort = mkOption {
        type = types.port;
        default = 7700;
        description = "Port for locally managed Meilisearch.";
      };

      url = mkOption {
        type = types.str;
        default = "http://127.0.0.1:7700";
        description = "Meilisearch base URL passed to the API.";
      };

      masterKeyFile = mkOption {
        type = types.nullOr types.path;
        default = null;
        description = "File containing the Meilisearch master key.";
      };
    };

    email = {
      provider = mkOption {
        type = types.enum ["console" "smtp"];
        default = "console";
        description = "Email delivery mode.";
      };

      from = mkOption {
        type = types.str;
        default = "auth@eulesia.local";
        description = "Sender address for platform email.";
      };

      smtp = {
        host = mkOption {
          type = types.nullOr types.str;
          default = null;
          description = "SMTP host for outbound email.";
        };

        port = mkOption {
          type = types.port;
          default = 587;
          description = "SMTP port.";
        };

        secure = mkOption {
          type = types.bool;
          default = false;
          description = "Whether to use SMTPS/TLS.";
        };

        userFile = mkOption {
          type = types.nullOr types.path;
          default = null;
          description = "File containing the SMTP username.";
        };

        passFile = mkOption {
          type = types.nullOr types.path;
          default = null;
          description = "File containing the SMTP password.";
        };
      };
    };

    auth = {
      sessionSecretFile = mkOption {
        type = types.nullOr types.path;
        default = null;
        description = "File containing the session signing secret.";
      };

      cookieDomain = mkOption {
        type = types.nullOr types.str;
        default = null;
        description = "Cookie domain for the web client.";
      };

      nativeOrigins = mkOption {
        type = types.listOf types.str;
        default = [
          "capacitor://localhost"
          "https://localhost"
        ];
        description = "Additional native app origins allowed by the API.";
      };
    };

    push = {
      vapidPublicKeyFile = mkOption {
        type = types.nullOr types.path;
        default = null;
        description = "File containing the public VAPID key.";
      };

      vapidPrivateKeyFile = mkOption {
        type = types.nullOr types.path;
        default = null;
        description = "File containing the private VAPID key.";
      };

      vapidSubject = mkOption {
        type = types.str;
        default = "mailto:admin@eulesia.eu";
        description = "VAPID contact subject.";
      };

      firebaseServiceAccountKeyFile = mkOption {
        type = types.nullOr types.path;
        default = null;
        description = "File containing the Firebase service account JSON.";
      };
    };

    ai = {
      mistralApiKeyFile = mkOption {
        type = types.nullOr types.path;
        default = null;
        description = "File containing the Mistral API key.";
      };

      mistralModel = mkOption {
        type = types.str;
        default = "mistral-small-latest";
        description = "Mistral model name used for imports and summaries.";
      };
    };

    tls = {
      enable = mkOption {
        type = types.bool;
        default = true;
        description = "Whether nginx should terminate TLS with ACME.";
      };

      acmeEmail = mkOption {
        type = types.nullOr types.str;
        default = null;
        description = "ACME registration email for nginx-managed certificates.";
      };
    };

    nginx.enable = mkOption {
      type = types.bool;
      default = true;
      description = "Whether to configure nginx virtual hosts for Eulesia.";
    };

    extraEnvironment = mkOption {
      type = types.attrsOf types.str;
      default = {};
      description = "Additional plain-text environment variables for the API.";
    };

    extraSecretEnvironmentFiles = mkOption {
      type = types.attrsOf types.path;
      default = {};
      description = "Additional environment variables loaded from files.";
    };
  };

  config = mkIf cfg.enable {
    assertions = [
      {
        assertion = cfg.package != null;
        message = "services.eulesia.package must be set when the service is enabled.";
      }
      {
        assertion = cfg.frontendPackage != null;
        message = "services.eulesia.frontendPackage must be set when the service is enabled.";
      }
      {
        assertion = !(cfg.database.createLocally && cfg.database.user != cfg.user);
        message = "Local PostgreSQL expects services.eulesia.database.user to match services.eulesia.user for peer authentication.";
      }
      {
        assertion = !cfg.tls.enable || cfg.tls.acmeEmail != null;
        message = "Set services.eulesia.tls.acmeEmail when TLS is enabled.";
      }
    ];

    users = {
      groups.${cfg.group} = {};
      users.${cfg.user} = {
        isSystemUser = true;
        inherit (cfg) group;
        home = cfg.stateDir;
        createHome = true;
      };
    };

    systemd.tmpfiles.rules = [
      "d ${cfg.stateDir} 0750 ${cfg.user} ${cfg.group} -"
      "d ${cfg.uploadsDir} 0750 ${cfg.user} ${cfg.group} -"
    ];

    services = {
      postgresql = mkIf cfg.database.createLocally {
        enable = true;
        ensureDatabases = [cfg.database.name];
        ensureUsers = [
          {
            name = cfg.database.user;
            ensureDBOwnership = true;
          }
        ];
      };

      meilisearch = mkIf cfg.meilisearch.createLocally {
        enable = true;
        inherit (cfg.meilisearch) listenAddress listenPort masterKeyFile;
      };

      nginx = mkIf cfg.nginx.enable {
        enable = true;
        recommendedProxySettings = true;
        recommendedGzipSettings = true;
        recommendedTlsSettings = cfg.tls.enable;
        appendHttpConfig = ''
          map $http_user_agent $eulesia_og_bot {
            default 0;
            ~*${ogBotRegex} 1;
          }
        '';
        virtualHosts = {
          ${cfg.apiDomain} = {
            enableACME = cfg.tls.enable;
            forceSSL = cfg.tls.enable;
            locations = {
              "/" = {
                proxyPass = apiProxy;
                proxyWebsockets = true;
              };
            };
          };

          ${cfg.appDomain} = {
            root = cfg.frontendPackage;
            enableACME = cfg.tls.enable;
            forceSSL = cfg.tls.enable;
            locations = {
              "/" = {
                extraConfig = ''
                  try_files $uri $uri/ /index.html;
                '';
              };
              "/api/" = {
                proxyPass = apiProxy;
                proxyWebsockets = true;
              };
              "/uploads/" = {
                proxyPass = apiProxy;
              };
              "/sitemap.xml" = {
                proxyPass = apiProxy;
              };
              "/.well-known/" = {
                proxyPass = apiProxy;
              };
              "/health" = {
                proxyPass = apiProxy;
              };
              "~ ^/(agora|clubs/|kunnat/|user/|aiheet)" = {
                extraConfig = ''
                  if ($eulesia_og_bot) {
                    proxy_pass ${apiProxy};
                    break;
                  }
                  try_files $uri $uri/ /index.html;
                '';
              };
            };
          };
        };
      };
    };

    systemd.services.eulesia-api = {
      description = "Eulesia API";
      wantedBy = ["multi-user.target"];
      wants =
        ["network-online.target"]
        ++ optional cfg.database.createLocally "postgresql.service"
        ++ optional cfg.meilisearch.createLocally "meilisearch.service";
      after =
        ["network-online.target"]
        ++ optional cfg.database.createLocally "postgresql.service"
        ++ optional cfg.meilisearch.createLocally "meilisearch.service";
      preStart = ''
        set -euo pipefail
        ${apiEnvironment}
        ${cfg.package}/bin/eulesia-api-migrate
      '';
      serviceConfig = {
        Type = "simple";
        User = cfg.user;
        Group = cfg.group;
        WorkingDirectory = cfg.stateDir;
        Restart = "on-failure";
        RestartSec = 5;
        UMask = "0077";
        ReadWritePaths = [
          cfg.stateDir
          cfg.uploadsDir
        ];
      };
      script = ''
        set -euo pipefail
        ${apiEnvironment}
        exec ${cfg.package}/bin/eulesia-api
      '';
    };

    security.acme = mkIf cfg.tls.enable {
      acceptTerms = true;
      defaults.email = cfg.tls.acmeEmail;
    };

    networking.firewall.allowedTCPPorts = optionals cfg.nginx.enable (
      if cfg.tls.enable
      then [
        80
        443
      ]
      else [80]
    );
  };
}
