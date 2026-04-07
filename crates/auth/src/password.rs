use argon2::{
    Argon2,
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString, rand_core::OsRng},
};

use crate::error::AuthError;

pub fn hash_password(password: &str) -> Result<String, AuthError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|_| AuthError::HashingFailed)
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, AuthError> {
    let parsed = PasswordHash::new(hash).map_err(|_| AuthError::HashingFailed)?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

pub fn validate_password_strength(password: &str) -> Result<(), AuthError> {
    if password.len() < 8 {
        return Err(AuthError::WeakPassword {
            reason: "password must be at least 8 characters".into(),
        });
    }
    if password.len() > 128 {
        return Err(AuthError::WeakPassword {
            reason: "password must be at most 128 characters".into(),
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_and_verify_roundtrip() {
        let hash = hash_password("test_password").unwrap();
        assert!(verify_password("test_password", &hash).unwrap());
    }

    #[test]
    fn verify_wrong_password() {
        let hash = hash_password("correct").unwrap();
        assert!(!verify_password("wrong", &hash).unwrap());
    }

    #[test]
    fn validate_strength_accepts_8_chars() {
        assert!(validate_password_strength("abcdefgh").is_ok());
    }

    #[test]
    fn validate_strength_rejects_7_chars() {
        let err = validate_password_strength("abcdefg").unwrap_err();
        assert!(matches!(err, AuthError::WeakPassword { .. }));
    }

    #[test]
    fn validate_strength_rejects_129_chars() {
        let long = "a".repeat(129);
        let err = validate_password_strength(&long).unwrap_err();
        assert!(matches!(err, AuthError::WeakPassword { .. }));
    }

    #[test]
    fn validate_strength_accepts_128_chars() {
        let long = "a".repeat(128);
        assert!(validate_password_strength(&long).is_ok());
    }
}
