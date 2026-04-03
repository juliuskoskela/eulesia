use sea_orm_migration::{prelude::*, schema::*};

pub struct Migration;

const MIGRATION_NAME: &str = "m20260403_000002_content_moderation_geo";

impl MigrationName for Migration {
    fn name(&self) -> &str {
        MIGRATION_NAME
    }
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    #[allow(clippy::too_many_lines)]
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // ══════════════════════════════════════
        // Location / Geo
        // ══════════════════════════════════════

        manager
            .create_table(
                Table::create()
                    .table(Municipalities::Table)
                    .col(uuid(Municipalities::Id).primary_key())
                    .col(string_len(Municipalities::Name, 255).not_null())
                    .col(string_len_null(Municipalities::NameFi, 255))
                    .col(string_len_null(Municipalities::NameSv, 255))
                    .col(string_len_null(Municipalities::Region, 255))
                    .col(string_len_null(Municipalities::Country, 2))
                    .col(integer_null(Municipalities::Population))
                    .col(decimal_null(Municipalities::Latitude))
                    .col(decimal_null(Municipalities::Longitude))
                    .col(json_binary_null(Municipalities::Bounds))
                    .col(
                        timestamp_with_time_zone(Municipalities::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Locations::Table)
                    .col(uuid(Locations::Id).primary_key())
                    .col(big_integer_null(Locations::OsmId))
                    .col(string_len_null(Locations::OsmType, 20))
                    .col(string_len(Locations::Name, 255).not_null())
                    .col(string_len_null(Locations::NameLocal, 255))
                    .col(string_len_null(Locations::NameFi, 255))
                    .col(string_len_null(Locations::NameSv, 255))
                    .col(string_len_null(Locations::NameEn, 255))
                    .col(integer_null(Locations::AdminLevel))
                    .col(string_len_null(Locations::Type, 50))
                    .col(uuid_null(Locations::ParentId))
                    .col(string_len_null(Locations::Country, 2))
                    .col(decimal_null(Locations::Latitude))
                    .col(decimal_null(Locations::Longitude))
                    .col(json_binary_null(Locations::Bounds))
                    .col(big_integer_null(Locations::Population))
                    .col(
                        string_len(Locations::Status, 20)
                            .not_null()
                            .default("active"),
                    )
                    .col(integer(Locations::ContentCount).not_null().default(0))
                    .col(
                        timestamp_with_time_zone(Locations::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Places::Table)
                    .col(uuid(Places::Id).primary_key())
                    .col(string_len(Places::Name, 255).not_null())
                    .col(string_len_null(Places::NameFi, 255))
                    .col(string_len_null(Places::NameSv, 255))
                    .col(string_len_null(Places::NameEn, 255))
                    .col(text_null(Places::Description))
                    .col(decimal_null(Places::Latitude))
                    .col(decimal_null(Places::Longitude))
                    .col(decimal_null(Places::RadiusKm))
                    .col(json_binary_null(Places::Geojson))
                    .col(string_len(Places::Type, 50).not_null())
                    .col(string_len_null(Places::Category, 100))
                    .col(string_len_null(Places::Subcategory, 100))
                    .col(uuid_null(Places::MunicipalityId))
                    .col(uuid_null(Places::LocationId))
                    .col(string_len_null(Places::Country, 2))
                    .col(string_len_null(Places::Address, 500))
                    .col(string_len(Places::Source, 20).not_null().default("user"))
                    .col(string_len_null(Places::SourceId, 255))
                    .col(string_len_null(Places::OsmId, 50))
                    .col(json_binary_null(Places::Metadata))
                    .col(uuid_null(Places::CreatedBy))
                    .col(
                        timestamp_with_time_zone(Places::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(Places::UpdatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Places::Table, Places::MunicipalityId)
                            .to(Municipalities::Table, Municipalities::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Places::Table, Places::LocationId)
                            .to(Locations::Table, Locations::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .get_connection()
            .execute_unprepared(
                "CREATE TRIGGER places_updated_at BEFORE UPDATE ON places FOR EACH ROW EXECUTE FUNCTION set_updated_at()",
            )
            .await?;

        // ══════════════════════════════════════
        // Public Content
        // ══════════════════════════════════════

        manager
            .create_table(
                Table::create()
                    .table(Threads::Table)
                    .col(uuid(Threads::Id).primary_key())
                    .col(string_len(Threads::Title, 500).not_null())
                    .col(text(Threads::Content).not_null())
                    .col(text_null(Threads::ContentHtml))
                    .col(uuid(Threads::AuthorId).not_null())
                    .col(string_len(Threads::Scope, 20).not_null())
                    .col(string_len_null(Threads::Country, 2))
                    .col(uuid_null(Threads::MunicipalityId))
                    .col(uuid_null(Threads::LocationId))
                    .col(uuid_null(Threads::PlaceId))
                    .col(decimal_null(Threads::Latitude))
                    .col(decimal_null(Threads::Longitude))
                    .col(json_binary_null(Threads::InstitutionalContext))
                    .col(boolean(Threads::IsPinned).not_null().default(false))
                    .col(boolean(Threads::IsLocked).not_null().default(false))
                    .col(integer(Threads::ReplyCount).not_null().default(0))
                    .col(integer(Threads::Score).not_null().default(0))
                    .col(integer(Threads::ViewCount).not_null().default(0))
                    .col(string_len(Threads::Source, 30).not_null().default("user"))
                    .col(string_len_null(Threads::SourceUrl, 1000))
                    .col(string_len_null(Threads::SourceId, 255))
                    .col(uuid_null(Threads::SourceInstitutionId))
                    .col(boolean(Threads::AiGenerated).not_null().default(false))
                    .col(string_len_null(Threads::AiModel, 100))
                    .col(string_len_null(Threads::Language, 10))
                    .col(boolean(Threads::IsHidden).not_null().default(false))
                    .col(timestamp_with_time_zone_null(Threads::DeletedAt))
                    .col(
                        timestamp_with_time_zone(Threads::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(Threads::UpdatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Threads::Table, Threads::AuthorId)
                            .to(Users::Table, Users::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Threads::Table, Threads::MunicipalityId)
                            .to(Municipalities::Table, Municipalities::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Threads::Table, Threads::PlaceId)
                            .to(Places::Table, Places::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .get_connection()
            .execute_unprepared(
                "CREATE TRIGGER threads_updated_at BEFORE UPDATE ON threads FOR EACH ROW EXECUTE FUNCTION set_updated_at()",
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_threads_scope")
                    .table(Threads::Table)
                    .col(Threads::Scope)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_threads_author")
                    .table(Threads::Table)
                    .col(Threads::AuthorId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_threads_created")
                    .table(Threads::Table)
                    .col((Threads::CreatedAt, IndexOrder::Desc))
                    .to_owned(),
            )
            .await?;

        // Thread tags
        manager
            .create_table(
                Table::create()
                    .table(ThreadTags::Table)
                    .col(uuid(ThreadTags::ThreadId).not_null())
                    .col(string_len(ThreadTags::Tag, 100).not_null())
                    .primary_key(
                        Index::create()
                            .col(ThreadTags::ThreadId)
                            .col(ThreadTags::Tag),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(ThreadTags::Table, ThreadTags::ThreadId)
                            .to(Threads::Table, Threads::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Comments
        manager
            .create_table(
                Table::create()
                    .table(Comments::Table)
                    .col(uuid(Comments::Id).primary_key())
                    .col(uuid(Comments::ThreadId).not_null())
                    .col(uuid_null(Comments::ParentId))
                    .col(uuid(Comments::AuthorId).not_null())
                    .col(text(Comments::Content).not_null())
                    .col(text_null(Comments::ContentHtml))
                    .col(integer(Comments::Depth).not_null().default(0))
                    .col(integer(Comments::Score).not_null().default(0))
                    .col(string_len_null(Comments::Language, 10))
                    .col(boolean(Comments::IsHidden).not_null().default(false))
                    .col(timestamp_with_time_zone_null(Comments::DeletedAt))
                    .col(
                        timestamp_with_time_zone(Comments::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(Comments::UpdatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Comments::Table, Comments::ThreadId)
                            .to(Threads::Table, Threads::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Comments::Table, Comments::AuthorId)
                            .to(Users::Table, Users::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .get_connection()
            .execute_unprepared(
                "CREATE TRIGGER comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION set_updated_at()",
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_comments_thread")
                    .table(Comments::Table)
                    .col(Comments::ThreadId)
                    .to_owned(),
            )
            .await?;

        // Votes
        manager
            .create_table(
                Table::create()
                    .table(ThreadVotes::Table)
                    .col(uuid(ThreadVotes::ThreadId).not_null())
                    .col(uuid(ThreadVotes::UserId).not_null())
                    .col(small_integer(ThreadVotes::Value).not_null())
                    .col(
                        timestamp_with_time_zone(ThreadVotes::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .primary_key(
                        Index::create()
                            .col(ThreadVotes::ThreadId)
                            .col(ThreadVotes::UserId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(ThreadVotes::Table, ThreadVotes::ThreadId)
                            .to(Threads::Table, Threads::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(ThreadVotes::Table, ThreadVotes::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(CommentVotes::Table)
                    .col(uuid(CommentVotes::CommentId).not_null())
                    .col(uuid(CommentVotes::UserId).not_null())
                    .col(small_integer(CommentVotes::Value).not_null())
                    .col(
                        timestamp_with_time_zone(CommentVotes::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .primary_key(
                        Index::create()
                            .col(CommentVotes::CommentId)
                            .col(CommentVotes::UserId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(CommentVotes::Table, CommentVotes::CommentId)
                            .to(Comments::Table, Comments::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(CommentVotes::Table, CommentVotes::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Bookmarks
        manager
            .create_table(
                Table::create()
                    .table(Bookmarks::Table)
                    .col(uuid(Bookmarks::UserId).not_null())
                    .col(uuid(Bookmarks::ThreadId).not_null())
                    .col(
                        timestamp_with_time_zone(Bookmarks::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .primary_key(
                        Index::create()
                            .col(Bookmarks::UserId)
                            .col(Bookmarks::ThreadId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Bookmarks::Table, Bookmarks::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Bookmarks::Table, Bookmarks::ThreadId)
                            .to(Threads::Table, Threads::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // ══════════════════════════════════════
        // Moderation
        // ══════════════════════════════════════

        manager
            .create_table(
                Table::create()
                    .table(ContentReports::Table)
                    .col(uuid(ContentReports::Id).primary_key())
                    .col(uuid(ContentReports::ReporterId).not_null())
                    .col(string_len(ContentReports::ContentType, 50).not_null())
                    .col(uuid(ContentReports::ContentId).not_null())
                    .col(string_len(ContentReports::Reason, 30).not_null())
                    .col(text_null(ContentReports::Description))
                    .col(binary_null(ContentReports::Evidence))
                    .col(
                        string_len(ContentReports::Status, 20)
                            .not_null()
                            .default("pending"),
                    )
                    .col(uuid_null(ContentReports::AssignedTo))
                    .col(timestamp_with_time_zone_null(ContentReports::ResolvedAt))
                    .col(
                        timestamp_with_time_zone(ContentReports::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(ContentReports::Table, ContentReports::ReporterId)
                            .to(Users::Table, Users::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_reports_status")
                    .table(ContentReports::Table)
                    .col(ContentReports::Status)
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(ModerationActions::Table)
                    .col(uuid(ModerationActions::Id).primary_key())
                    .col(uuid(ModerationActions::AdminId).not_null())
                    .col(string_len(ModerationActions::ActionType, 50).not_null())
                    .col(string_len(ModerationActions::TargetType, 50).not_null())
                    .col(uuid(ModerationActions::TargetId).not_null())
                    .col(uuid_null(ModerationActions::ReportId))
                    .col(text_null(ModerationActions::Reason))
                    .col(json_binary_null(ModerationActions::Metadata))
                    .col(
                        timestamp_with_time_zone(ModerationActions::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(ModerationActions::Table, ModerationActions::ReportId)
                            .to(ContentReports::Table, ContentReports::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(UserSanctions::Table)
                    .col(uuid(UserSanctions::Id).primary_key())
                    .col(uuid(UserSanctions::UserId).not_null())
                    .col(string_len(UserSanctions::SanctionType, 20).not_null())
                    .col(text_null(UserSanctions::Reason))
                    .col(uuid(UserSanctions::IssuedBy).not_null())
                    .col(
                        timestamp_with_time_zone(UserSanctions::IssuedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(timestamp_with_time_zone_null(UserSanctions::ExpiresAt))
                    .col(timestamp_with_time_zone_null(UserSanctions::RevokedAt))
                    .col(uuid_null(UserSanctions::RevokedBy))
                    .foreign_key(
                        ForeignKey::create()
                            .from(UserSanctions::Table, UserSanctions::UserId)
                            .to(Users::Table, Users::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(ModerationAppeals::Table)
                    .col(uuid(ModerationAppeals::Id).primary_key())
                    .col(uuid(ModerationAppeals::UserId).not_null())
                    .col(uuid_null(ModerationAppeals::SanctionId))
                    .col(uuid_null(ModerationAppeals::ReportId))
                    .col(uuid_null(ModerationAppeals::ActionId))
                    .col(text(ModerationAppeals::Reason).not_null())
                    .col(
                        string_len(ModerationAppeals::Status, 20)
                            .not_null()
                            .default("pending"),
                    )
                    .col(text_null(ModerationAppeals::AdminResponse))
                    .col(uuid_null(ModerationAppeals::RespondedBy))
                    .col(timestamp_with_time_zone_null(
                        ModerationAppeals::RespondedAt,
                    ))
                    .col(
                        timestamp_with_time_zone(ModerationAppeals::CreatedAt)
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(ModerationAppeals::Table, ModerationAppeals::UserId)
                            .to(Users::Table, Users::Id),
                    )
                    .to_owned(),
            )
            .await?;

        // CHECK constraints
        manager
            .get_connection()
            .execute_unprepared(
                "
                ALTER TABLE threads ADD CONSTRAINT chk_threads_scope CHECK (scope IN ('local', 'national', 'european'));
                ALTER TABLE threads ADD CONSTRAINT chk_threads_source CHECK (source IN ('user', 'minutes_import', 'rss_import'));
                ALTER TABLE thread_votes ADD CONSTRAINT chk_thread_votes_value CHECK (value IN (-1, 1));
                ALTER TABLE comment_votes ADD CONSTRAINT chk_comment_votes_value CHECK (value IN (-1, 1));
                ALTER TABLE content_reports ADD CONSTRAINT chk_reports_reason CHECK (reason IN ('illegal', 'harassment', 'spam', 'misinformation', 'other'));
                ALTER TABLE content_reports ADD CONSTRAINT chk_reports_status CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed'));
                ALTER TABLE user_sanctions ADD CONSTRAINT chk_sanctions_type CHECK (sanction_type IN ('warning', 'suspension', 'ban'));
                ALTER TABLE moderation_appeals ADD CONSTRAINT chk_appeals_status CHECK (status IN ('pending', 'accepted', 'rejected'));
                ALTER TABLE places ADD CONSTRAINT chk_places_type CHECK (type IN ('poi', 'area', 'route', 'landmark', 'building'));
                ALTER TABLE places ADD CONSTRAINT chk_places_source CHECK (source IN ('user', 'osm', 'lipas', 'mml', 'municipal'));
                ",
            )
            .await?;

        // ── Additional FK constraints ──
        manager
            .get_connection()
            .execute_unprepared(
                "
                ALTER TABLE comments ADD CONSTRAINT fk_comments_parent FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE SET NULL;
                ALTER TABLE locations ADD CONSTRAINT fk_locations_parent FOREIGN KEY (parent_id) REFERENCES locations(id);
                ALTER TABLE threads ADD CONSTRAINT fk_threads_location FOREIGN KEY (location_id) REFERENCES locations(id);
                ALTER TABLE places ADD CONSTRAINT fk_places_created_by FOREIGN KEY (created_by) REFERENCES users(id);
                ALTER TABLE content_reports ADD CONSTRAINT fk_reports_assigned FOREIGN KEY (assigned_to) REFERENCES users(id);
                ALTER TABLE moderation_actions ADD CONSTRAINT fk_mod_actions_admin FOREIGN KEY (admin_id) REFERENCES users(id);
                ALTER TABLE user_sanctions ADD CONSTRAINT fk_sanctions_issued_by FOREIGN KEY (issued_by) REFERENCES users(id);
                ALTER TABLE user_sanctions ADD CONSTRAINT fk_sanctions_revoked_by FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL;
                ALTER TABLE moderation_appeals ADD CONSTRAINT fk_appeals_sanction FOREIGN KEY (sanction_id) REFERENCES user_sanctions(id);
                ALTER TABLE moderation_appeals ADD CONSTRAINT fk_appeals_report FOREIGN KEY (report_id) REFERENCES content_reports(id);
                ALTER TABLE moderation_appeals ADD CONSTRAINT fk_appeals_action FOREIGN KEY (action_id) REFERENCES moderation_actions(id);
                ALTER TABLE moderation_appeals ADD CONSTRAINT fk_appeals_responded_by FOREIGN KEY (responded_by) REFERENCES users(id);
                ",
            )
            .await?;

        // ── Additional indexes ──
        manager
            .create_index(
                Index::create()
                    .name("idx_locations_parent")
                    .table(Locations::Table)
                    .col(Locations::ParentId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_reports_assigned")
                    .table(ContentReports::Table)
                    .col(ContentReports::AssignedTo)
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("idx_sanctions_user_expires")
                    .table(UserSanctions::Table)
                    .col(UserSanctions::UserId)
                    .col(UserSanctions::ExpiresAt)
                    .to_owned(),
            )
            .await?;
        manager
            .get_connection()
            .execute_unprepared(
                "CREATE INDEX idx_threads_municipality_created ON threads (municipality_id, created_at DESC)",
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let tables = [
            ModerationAppeals::Table.into_table_ref(),
            UserSanctions::Table.into_table_ref(),
            ModerationActions::Table.into_table_ref(),
            ContentReports::Table.into_table_ref(),
            Bookmarks::Table.into_table_ref(),
            CommentVotes::Table.into_table_ref(),
            ThreadVotes::Table.into_table_ref(),
            Comments::Table.into_table_ref(),
            ThreadTags::Table.into_table_ref(),
            Threads::Table.into_table_ref(),
            Places::Table.into_table_ref(),
            Locations::Table.into_table_ref(),
            Municipalities::Table.into_table_ref(),
        ];

        for table in tables {
            manager
                .drop_table(Table::drop().table(table).if_exists().to_owned())
                .await?;
        }

        Ok(())
    }
}

// ── Iden enums ──

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum Municipalities {
    Table,
    Id,
    Name,
    NameFi,
    NameSv,
    Region,
    Country,
    Population,
    Latitude,
    Longitude,
    Bounds,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Locations {
    Table,
    Id,
    OsmId,
    OsmType,
    Name,
    NameLocal,
    NameFi,
    NameSv,
    NameEn,
    AdminLevel,
    Type,
    ParentId,
    Country,
    Latitude,
    Longitude,
    Bounds,
    Population,
    Status,
    ContentCount,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Places {
    Table,
    Id,
    Name,
    NameFi,
    NameSv,
    NameEn,
    Description,
    Latitude,
    Longitude,
    RadiusKm,
    Geojson,
    Type,
    Category,
    Subcategory,
    MunicipalityId,
    LocationId,
    Country,
    Address,
    Source,
    SourceId,
    OsmId,
    Metadata,
    CreatedBy,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Threads {
    Table,
    Id,
    Title,
    Content,
    ContentHtml,
    AuthorId,
    Scope,
    Country,
    MunicipalityId,
    LocationId,
    PlaceId,
    Latitude,
    Longitude,
    InstitutionalContext,
    IsPinned,
    IsLocked,
    ReplyCount,
    Score,
    ViewCount,
    Source,
    SourceUrl,
    SourceId,
    SourceInstitutionId,
    AiGenerated,
    AiModel,
    Language,
    IsHidden,
    DeletedAt,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum ThreadTags {
    Table,
    ThreadId,
    Tag,
}

#[derive(DeriveIden)]
enum Comments {
    Table,
    Id,
    ThreadId,
    ParentId,
    AuthorId,
    Content,
    ContentHtml,
    Depth,
    Score,
    Language,
    IsHidden,
    DeletedAt,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum ThreadVotes {
    Table,
    ThreadId,
    UserId,
    Value,
    CreatedAt,
}

#[derive(DeriveIden)]
enum CommentVotes {
    Table,
    CommentId,
    UserId,
    Value,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Bookmarks {
    Table,
    UserId,
    ThreadId,
    CreatedAt,
}

#[derive(DeriveIden)]
enum ContentReports {
    Table,
    Id,
    ReporterId,
    ContentType,
    ContentId,
    Reason,
    Description,
    Evidence,
    Status,
    AssignedTo,
    ResolvedAt,
    CreatedAt,
}

#[derive(DeriveIden)]
enum ModerationActions {
    Table,
    Id,
    AdminId,
    ActionType,
    TargetType,
    TargetId,
    ReportId,
    Reason,
    Metadata,
    CreatedAt,
}

#[derive(DeriveIden)]
enum UserSanctions {
    Table,
    Id,
    UserId,
    SanctionType,
    Reason,
    IssuedBy,
    IssuedAt,
    ExpiresAt,
    RevokedAt,
    RevokedBy,
}

#[derive(DeriveIden)]
enum ModerationAppeals {
    Table,
    Id,
    UserId,
    SanctionId,
    ReportId,
    ActionId,
    Reason,
    Status,
    AdminResponse,
    RespondedBy,
    RespondedAt,
    CreatedAt,
}
