{
  config,
  secretDir,
}: let
  mkBinarySecret = name: {
    owner = config.services.eulesia.user;
    inherit (config.services.eulesia) group;
    format = "binary";
    sopsFile = secretDir + "/${name}.enc";
    path = "/run/secrets/eulesia/${name}";
  };
in {
  "session-secret" = mkBinarySecret "session-secret";
  "meili-master-key" = mkBinarySecret "meili-master-key";
  "mistral-api-key" = mkBinarySecret "mistral-api-key";
  "smtp-user" = mkBinarySecret "smtp-user";
  "smtp-pass" = mkBinarySecret "smtp-pass";
  "vapid-public-key" = mkBinarySecret "vapid-public-key";
  "vapid-private-key" = mkBinarySecret "vapid-private-key";
  "firebase-service-account.json" = mkBinarySecret "firebase-service-account.json";
  "idura-client-secret" = mkBinarySecret "idura-client-secret";
}
