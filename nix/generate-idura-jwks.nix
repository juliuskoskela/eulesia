{pkgs}:
pkgs.writeShellApplication {
  name = "generate-idura-jwks";
  runtimeInputs = with pkgs; [
    coreutils
    jq
    jose
  ];
  text = ''
    set -euo pipefail

    out_dir="''${1:-local/idura-jwks}"
    sig_kid="''${SIG_KID:-idura-sig-1}"
    enc_kid="''${ENC_KID:-idura-enc-1}"

    mkdir -p "$out_dir"

    sig_template="$out_dir/idura-signing-key.template.json"
    enc_template="$out_dir/idura-encryption-key.template.json"
    sig_jwk="$out_dir/idura-signing-key.jwk.json"
    enc_jwk="$out_dir/idura-encryption-key.jwk.json"
    public_jwks="$out_dir/idura-client-jwks.public.json"

    cat > "$sig_template" <<EOF
    {
      "kty": "EC",
      "crv": "P-256",
      "use": "sig",
      "alg": "ES256",
      "kid": "$sig_kid"
    }
    EOF

    cat > "$enc_template" <<EOF
    {
      "kty": "RSA",
      "size": 2048,
      "use": "enc",
      "alg": "RSA-OAEP-256",
      "kid": "$enc_kid"
    }
    EOF

    jose jwk gen -i "$sig_template" -o "$sig_jwk"
    jose jwk gen -i "$enc_template" -o "$enc_jwk"

    jq -s '{
      keys: [.[] | del(.d, .p, .q, .dp, .dq, .qi, .oth, .size)]
    }' "$sig_jwk" "$enc_jwk" > "$public_jwks"

    rm -f "$sig_template" "$enc_template"

    printf 'Generated FTN client key material:\n'
    printf '  %s\n' "$sig_jwk"
    printf '  %s\n' "$enc_jwk"
    printf '  %s\n' "$public_jwks"
    printf '\nUpload %s to the Idura Dashboard as the static client JWKS.\n' "$public_jwks"
  '';
}
