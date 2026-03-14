{
  config,
  eulesiaPackages,
  lib,
  ...
}: let
  eulesiaSecret = name: {
    owner = config.services.eulesia.user;
    group = config.services.eulesia.group;
    path = "/run/secrets/eulesia/${name}";
  };
in {
  imports = [
    ../modules/eulesia.nix
  ];

  networking.hostName = "eulesia-prod";
  networking.useDHCP = lib.mkDefault true;

  boot.loader.grub.device = "/dev/sda";
  fileSystems."/" = {
    device = "/dev/disk/by-label/nixos";
    fsType = "ext4";
  };

  services.openssh.enable = true;

  sops = {
    defaultSopsFile = ../../secrets/prod/secrets.yaml;
    age.keyFile = "/var/lib/sops-nix/key.txt";
    secrets = {
      "session-secret" = eulesiaSecret "session-secret";
      "meili-master-key" = eulesiaSecret "meili-master-key";
      "mistral-api-key" = eulesiaSecret "mistral-api-key";
      "smtp-user" = eulesiaSecret "smtp-user";
      "smtp-pass" = eulesiaSecret "smtp-pass";
      "vapid-public-key" = eulesiaSecret "vapid-public-key";
      "vapid-private-key" = eulesiaSecret "vapid-private-key";
      "firebase-service-account.json" = eulesiaSecret "firebase-service-account.json";
      "idura-client-secret" = eulesiaSecret "idura-client-secret";
    };
  };

  services.eulesia = {
    enable = true;
    package = eulesiaPackages.api;
    frontendPackage = eulesiaPackages.frontend;
    appDomain = "eulesia.eu";
    apiDomain = "api.eulesia.eu";
    tls.acmeEmail = "admin@eulesia.eu";
    auth.sessionSecretFile = config.sops.secrets."session-secret".path;
    meilisearch.masterKeyFile = config.sops.secrets."meili-master-key".path;
    ai.mistralApiKeyFile = config.sops.secrets."mistral-api-key".path;
    email.smtp.userFile = config.sops.secrets."smtp-user".path;
    email.smtp.passFile = config.sops.secrets."smtp-pass".path;
    push = {
      vapidPublicKeyFile = config.sops.secrets."vapid-public-key".path;
      vapidPrivateKeyFile = config.sops.secrets."vapid-private-key".path;
      firebaseServiceAccountKeyFile = config.sops.secrets."firebase-service-account.json".path;
    };
    extraSecretEnvironmentFiles = {
      IDURA_CLIENT_SECRET = config.sops.secrets."idura-client-secret".path;
    };
    extraEnvironment = {
      IDURA_DOMAIN = "idura.example.invalid";
      IDURA_CLIENT_ID = "replace-me";
      IDURA_CALLBACK_URL = "https://api.eulesia.eu/api/v1/auth/ftn/callback";
    };
  };

  system.stateVersion = "24.11";
}
