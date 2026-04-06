use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use tracing::{info, warn};

/// SMTP email client.
pub struct EmailClient {
    transport: Option<AsyncSmtpTransport<Tokio1Executor>>,
    from: String,
}

impl Default for EmailClient {
    fn default() -> Self {
        Self::new()
    }
}

impl EmailClient {
    pub fn new() -> Self {
        let (transport, from) = Self::load_config();
        if transport.is_some() {
            info!(from = %from, "SMTP email client configured");
        }
        Self { transport, from }
    }

    fn load_config() -> (Option<AsyncSmtpTransport<Tokio1Executor>>, String) {
        let host = match std::env::var("SMTP_HOST") {
            Ok(h) => h,
            Err(_) => return (None, String::new()),
        };
        let from = std::env::var("SMTP_FROM").unwrap_or_else(|_| "noreply@eulesia.org".into());

        let builder = match std::env::var("SMTP_PORT")
            .ok()
            .and_then(|p| p.parse::<u16>().ok())
        {
            Some(465) => AsyncSmtpTransport::<Tokio1Executor>::relay(&host).map(|b| b.port(465)),
            Some(port) => {
                AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&host).map(|b| b.port(port))
            }
            None => AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&host),
        };

        let builder = match builder {
            Ok(b) => b,
            Err(e) => {
                warn!(error = %e, "failed to configure SMTP transport");
                return (None, from);
            }
        };

        let transport = if let (Ok(user), Ok(pass)) = (
            std::env::var("SMTP_USERNAME"),
            std::env::var("SMTP_PASSWORD"),
        ) {
            builder.credentials(Credentials::new(user, pass)).build()
        } else {
            builder.build()
        };

        (Some(transport), from)
    }

    pub async fn send_email(&self, to: &str, subject: &str, body_html: &str) {
        let transport = match &self.transport {
            Some(t) => t,
            None => {
                info!(to, subject, "SMTP not configured, skipping email");
                return;
            }
        };

        let message =
            match Message::builder()
                .from(self.from.parse().unwrap_or_else(|_| {
                    "noreply@eulesia.org".parse().expect("valid fallback from")
                }))
                .to(match to.parse() {
                    Ok(addr) => addr,
                    Err(e) => {
                        warn!(to, error = %e, "invalid email recipient");
                        return;
                    }
                })
                .subject(subject)
                .header(ContentType::TEXT_HTML)
                .body(body_html.to_string())
            {
                Ok(m) => m,
                Err(e) => {
                    warn!(error = %e, "failed to build email message");
                    return;
                }
            };

        match transport.send(message).await {
            Ok(_) => info!(to, subject, "email sent"),
            Err(e) => warn!(to, subject, error = %e, "email send failed"),
        }
    }
}
