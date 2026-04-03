use clap::Parser;

#[derive(Parser, Debug, Clone)]
#[command(name = "eulesia-server", about = "Eulesia v2 API server")]
pub struct Config {
    /// Host address to bind to
    #[arg(long, env = "EULESIA_HOST", default_value = "127.0.0.1")]
    pub host: String,

    /// Port to listen on
    #[arg(short, long, env = "EULESIA_PORT", default_value_t = 3002)]
    pub port: u16,

    /// Log level (trace, debug, info, warn, error)
    #[arg(long, env = "EULESIA_LOG_LEVEL", default_value = "info")]
    pub log_level: String,

    /// Output logs as JSON
    #[arg(long, env = "EULESIA_LOG_JSON")]
    pub log_json: bool,

    /// Database connection URL
    #[arg(long, env = "DATABASE_URL")]
    pub database_url: Option<String>,
}

impl Config {
    pub fn parse() -> Self {
        <Self as Parser>::parse()
    }

    pub fn bind_addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}
