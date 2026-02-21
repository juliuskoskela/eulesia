{ pkgs }:

pkgs.writeShellApplication {
  name = "generate-idura-jwks";
  runtimeInputs = with pkgs; [
    coreutils
    jq
    jose
  ];
  text = ''
    set -euo pipefail

    out_dir="''${1:-.}"
    sig_kid="''${SIG_KID:-idura-sig-1}"
    enc_kid="''${ENC_KID:-idura-enc-1}"

    mkdir -p "$out_dir"

    sig_template="$out_dir/sig.template.json"
    enc_template="$out_dir/enc.template.json"
    sig_jwk="$out_dir/sig.jwk.json"
    enc_jwk="$out_dir/enc.jwk.json"
    private_jwks="$out_dir/jwks.private.json"
    public_jwks="$out_dir/jwks.public.json"

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

    jq -s '{keys: [.[] | del(.size)]}' "$sig_jwk" "$enc_jwk" > "$private_jwks"
    jq '{
      keys: [.keys[] | del(.d, .p, .q, .dp, .dq, .qi, .oth, .size)]
    }' "$private_jwks" > "$public_jwks"

    printf 'Generated:\n'
    printf '  %s\n' "$sig_template"
    printf '  %s\n' "$enc_template"
    printf '  %s\n' "$sig_jwk"
    printf '  %s\n' "$enc_jwk"
    printf '  %s\n' "$private_jwks"
    printf '  %s\n' "$public_jwks"
  '';
}
