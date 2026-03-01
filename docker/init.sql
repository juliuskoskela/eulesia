-- Initialize extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create scraper database (separate from main DB)
SELECT 'CREATE DATABASE eulesia_scraper'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'eulesia_scraper')\gexec

-- Enable uuid-ossp in scraper database too
\c eulesia_scraper
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
\c eulesia

-- Schema will be created by Drizzle migrations
