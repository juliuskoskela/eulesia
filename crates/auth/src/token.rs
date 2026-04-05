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
