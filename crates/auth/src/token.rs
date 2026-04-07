use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use rand::RngCore;
use sha2::{Digest, Sha256};

pub struct SessionToken {
    raw: String,
}

impl SessionToken {
    pub fn generate() -> Self {
        let mut bytes = [0u8; 32];
        rand::rng().fill_bytes(&mut bytes);
        Self {
            raw: URL_SAFE_NO_PAD.encode(bytes),
        }
    }

    pub fn from_raw(raw: &str) -> Self {
        Self {
            raw: raw.to_string(),
        }
    }

    /// SHA-256 hash of the raw token bytes, hex-encoded. This is stored in the DB.
    pub fn hash(&self) -> String {
        let mut hasher = Sha256::new();
        hasher.update(self.raw.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    pub fn as_str(&self) -> &str {
        &self.raw
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_produces_unique_tokens() {
        let a = SessionToken::generate();
        let b = SessionToken::generate();
        assert_ne!(a.as_str(), b.as_str());
    }

    #[test]
    fn generate_produces_base64url() {
        let t = SessionToken::generate();
        assert!(
            t.as_str()
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        );
    }

    #[test]
    fn hash_is_deterministic() {
        let t = SessionToken::from_raw("deterministic_test");
        assert_eq!(t.hash(), t.hash());
    }

    #[test]
    fn hash_is_hex_sha256() {
        let t = SessionToken::from_raw("test");
        let h = t.hash();
        assert_eq!(h.len(), 64);
        assert!(h.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn from_raw_preserves_value() {
        let t = SessionToken::from_raw("abc");
        assert_eq!(t.as_str(), "abc");
    }

    #[test]
    fn different_tokens_different_hashes() {
        let a = SessionToken::from_raw("token_a");
        let b = SessionToken::from_raw("token_b");
        assert_ne!(a.hash(), b.hash());
    }
}
