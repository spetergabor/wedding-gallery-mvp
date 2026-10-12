ALTER TABLE "GiftCardOrder"
ALTER COLUMN "email" DROP NOT NULL,
ADD COLUMN "delivered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "amountCents" INTEGER,
ADD COLUMN "photographed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "invoiceNumber" TEXT,
ADD COLUMN "externalId" TEXT,
ADD COLUMN "sourceOrder" INTEGER;

CREATE UNIQUE INDEX "GiftCardOrder_externalId_key"
ON "GiftCardOrder"("externalId");

CREATE INDEX "GiftCardOrder_adminId_paid_idx"
ON "GiftCardOrder"("adminId", "paid");

CREATE INDEX "GiftCardOrder_adminId_photographed_idx"
ON "GiftCardOrder"("adminId", "photographed");

WITH "sheetRows" (
  "sourceOrder",
  "customerName",
  "personCount",
  "recipientName",
  "delivered",
  "paid",
  "amountCents",
  "photographed",
  "message",
  "invoiceNumber",
  "deliveryAddress",
  "email"
) AS (
  VALUES
    (2, 'Celina Ulrich', 2, 'Thomas', TRUE, TRUE, 11000, TRUE, NULL, 'SP-1050', NULL, NULL),
    (3, 'Sandra Fasching', 2, 'Jessy Lee und Marvin', TRUE, TRUE, 11000, TRUE, NULL, 'SP-1048', NULL, NULL),
    (4, 'Florentina Sorger', 2, 'Max', TRUE, TRUE, 11000, FALSE, 'Online verzió elküldve', 'SP-1053', NULL, NULL),
    (5, 'Thomas Rieger', 2, 'Sarah', TRUE, TRUE, 11000, TRUE, 'terminnél fizet', NULL, NULL, NULL),
    (6, 'Kathrin Tenk', 2, 'Lisa', TRUE, TRUE, 11000, FALSE, NULL, 'SP-1054', NULL, NULL),
    (7, 'David Kara', 3, 'Silke Kara', TRUE, TRUE, 15000, FALSE, NULL, 'SP-1064', NULL, NULL),
    (8, 'Patrick Laipold', 4, 'Karin', TRUE, TRUE, 19000, TRUE, 'online kártya', 'SP-1067', NULL, NULL),
    (9, 'Stefan Fasstl', 4, 'Bettina', TRUE, TRUE, 19000, TRUE, NULL, 'SP-1068', NULL, NULL),
    (10, 'Harald Rinner', 4, 'Iris', TRUE, TRUE, 19000, FALSE, 'digital', 'SP-1083', NULL, NULL),
    (11, 'Johannes Heher', 3, 'Susi', TRUE, TRUE, 17000, TRUE, 'digital', 'Rechnung Nr. SP-1085', NULL, NULL),
    (12, 'Melanie Hasiba', 2, 'Isa - MArkus', TRUE, TRUE, 11000, FALSE, NULL, 'Rechnung Nr. SP-108', NULL, NULL),
    (13, 'Xenia Heindl', 2, 'Philipp', TRUE, TRUE, 11000, TRUE, NULL, 'SP-1113', NULL, NULL),
    (14, 'Carolina Leiter', 2, 'Stefan', TRUE, TRUE, 11000, FALSE, NULL, 'SP-1129', NULL, NULL),
    (15, 'Verena Hirmann', 1, 'Sabrina', TRUE, TRUE, 6000, TRUE, NULL, 'SP-1128', NULL, 'verenahirmann56@gmail.com'),
    (16, 'Kager Claudia', 1, '-', TRUE, TRUE, 6000, FALSE, NULL, 'SP-1131', NULL, NULL),
    (17, 'Laura', 1, 'Jasmin', TRUE, TRUE, 6000, FALSE, NULL, 'SP-1134', NULL, NULL),
    (18, 'Kerstin Schmid', 4, 'Lukas', TRUE, TRUE, 19000, TRUE, NULL, 'SP-1135', NULL, NULL),
    (19, 'Gerlinde Schelch', 2, 'Mona & Christian', TRUE, TRUE, 11000, FALSE, NULL, 'SP-1136', 'Göriach 165, 8625 Turnau', NULL),
    (20, 'Melanie Riedler', 4, 'mama un papa', TRUE, TRUE, 19000, TRUE, NULL, 'SP-1158', NULL, 'melanie.riedler@icloud.com'),
    (21, 'Marco Scherr', 4, 'Isabella Scherr', TRUE, TRUE, 19000, FALSE, NULL, 'SP-1175', NULL, NULL),
    (22, 'Carina Wallner', 3, 'Gerald', TRUE, TRUE, 15000, FALSE, NULL, 'SP-1176', NULL, NULL),
    (23, 'Uran Eva', 1, 'Günther', TRUE, TRUE, 6000, TRUE, NULL, 'SP-1179', NULL, NULL),
    (24, 'Sophie Wiessl', 4, 'Marion', TRUE, TRUE, 19000, TRUE, NULL, 'SP-1178', NULL, NULL),
    (25, 'Lisa Barones', 2, 'Matthias Wolkowitsch', TRUE, TRUE, 11000, FALSE, NULL, 'SP-1180', NULL, NULL),
    (26, 'Maximilian Binder', 2, 'Laura Stornig', TRUE, TRUE, 11000, TRUE, NULL, 'SP-1177', NULL, NULL),
    (27, 'Jakob Brandner', 2, 'Zeynep', TRUE, TRUE, 11000, TRUE, NULL, 'SP-1190', 'Weidenweg 1a, 8077 Gössendorf', NULL),
    (28, 'Petra Mosler', 2, 'Matthias & Michelle', TRUE, TRUE, 11000, TRUE, NULL, 'SP-1193', 'Eisenbergstraße 8, 8074 Raaba-Grambach', NULL),
    (29, 'Inga Mumper', 2, 'Victoria und Vanessa', TRUE, TRUE, 11000, TRUE, NULL, 'SP-1192', 'Johann Kamper-Ring 3/14, 8075 Hart bei Graz', NULL),
    (30, 'Hahn Elfriede', 2, 'Daniel und Birgit', TRUE, TRUE, 11000, FALSE, NULL, 'SP-1194', NULL, NULL),
    (31, 'Hahn Elfriede', 4, 'Denise', TRUE, TRUE, 19000, FALSE, NULL, 'SP-1194', NULL, NULL),
    (32, 'Erwin Spieler', 2, 'Pia', TRUE, FALSE, 11000, FALSE, NULL, NULL, NULL, NULL),
    (33, 'Cistoph', 2, 'Elena', TRUE, TRUE, 11000, TRUE, NULL, 'SP-1196', NULL, NULL),
    (34, 'Nicole Schreiner', 4, 'Anna, Julia, Luca, Mia', TRUE, TRUE, 19000, TRUE, NULL, 'SP-1197', NULL, NULL),
    (35, 'Hannes Winkler', 4, 'Familie', TRUE, TRUE, 19000, FALSE, NULL, 'SP-1199', NULL, NULL),
    (36, 'Michael Spielbichler', 4, 'Carmen', FALSE, FALSE, 19000, FALSE, NULL, NULL, NULL, NULL),
    (37, 'Stefan Höllwarth', 4, 'Kerstin Freudenreich', TRUE, TRUE, 19000, FALSE, NULL, 'SP-1267', NULL, NULL),
    (38, 'Philip Steinkellner', 2, 'Dora Domjanich', TRUE, TRUE, 11000, FALSE, NULL, NULL, NULL, NULL),
    (39, 'Vega Buchrieser', 2, 'Samuel', TRUE, TRUE, 11000, FALSE, NULL, NULL, NULL, NULL),
    (40, 'Norbert taxberger', 2, 'Emma', TRUE, TRUE, 11000, TRUE, NULL, 'SP-1352', NULL, NULL),
    (41, 'Anna Gruber', 2, 'Ulrike Schaffler', TRUE, TRUE, 12000, FALSE, 'ennek még kell számla', NULL, NULL, NULL),
    (42, 'Jitka Hiebler', 2, 'Claudia', TRUE, TRUE, 12000, TRUE, NULL, NULL, NULL, NULL),
    (43, 'Robert Gratzl', 4, 'Simone', TRUE, TRUE, 20000, TRUE, NULL, NULL, NULL, NULL),
    (44, 'Sandro LEtter', 2, 'Caroline', TRUE, TRUE, 12000, TRUE, NULL, NULL, NULL, NULL),
    (45, 'Hannah Schultermandl', 1, 'Valentina', TRUE, TRUE, 6000, TRUE, NULL, NULL, NULL, NULL),
    (46, 'Andreas Berger', 2, 'Daniela', TRUE, TRUE, 12000, FALSE, NULL, NULL, NULL, NULL),
    (47, 'Patrick Walzl', 2, 'Sabrina', TRUE, TRUE, 12000, TRUE, NULL, NULL, NULL, NULL),
    (48, 'Elisabeth Cernko', 4, 'Christa Cernko', TRUE, TRUE, 19900, FALSE, NULL, NULL, NULL, NULL),
    (49, 'Brigitte Meßner', 2, 'Tanja', TRUE, TRUE, 12000, FALSE, NULL, NULL, NULL, NULL),
    (50, 'Martin Egger', 2, 'Daniela', TRUE, TRUE, 12000, FALSE, NULL, NULL, NULL, NULL),
    (51, 'Fabian Wipplinger', 2, 'selina', TRUE, TRUE, 12000, TRUE, NULL, NULL, NULL, NULL),
    (52, 'Ewald', 2, 'Lynda Mario', TRUE, TRUE, 12000, FALSE, NULL, NULL, NULL, NULL),
    (53, 'Sarah Sommer', 1, 'Petra', TRUE, TRUE, 6000, FALSE, NULL, NULL, NULL, NULL),
    (54, 'Elisa Pichler', 2, 'SOnja', TRUE, TRUE, 12000, FALSE, NULL, NULL, NULL, NULL),
    (55, 'Nina Tomanova', 1, 'Anna Milchrahm', TRUE, TRUE, 6000, FALSE, NULL, NULL, NULL, NULL),
    (56, 'Philipp', 2, 'Marlene', TRUE, TRUE, 12000, FALSE, NULL, NULL, NULL, NULL),
    (57, 'Daniel Fadinger', 1, 'Kerstin', TRUE, TRUE, 6000, FALSE, NULL, NULL, NULL, NULL),
    (58, 'Sebastian Hiermann', 1, 'Beata', TRUE, TRUE, 6000, FALSE, NULL, NULL, NULL, NULL),
    (59, 'Vanesa Velic', 2, 'Hana und Dzevad', TRUE, TRUE, 12000, TRUE, NULL, NULL, NULL, NULL),
    (60, 'Daniel Hirtl', 2, 'Stefanie', TRUE, FALSE, 12000, FALSE, NULL, NULL, NULL, NULL)
),
"owner" AS (
  SELECT "id"
  FROM "Admin"
  WHERE LOWER("email") = 'spetergabor@gmail.com'
  LIMIT 1
)
INSERT INTO "GiftCardOrder" (
  "id",
  "adminId",
  "customerName",
  "email",
  "recipientName",
  "personCount",
  "deliveryMethod",
  "deliveryAddress",
  "message",
  "delivered",
  "paid",
  "amountCents",
  "photographed",
  "invoiceNumber",
  "externalId",
  "sourceOrder",
  "source",
  "createdAt",
  "updatedAt"
)
SELECT
  'gco_legacy_' || LPAD("sheetRows"."sourceOrder"::TEXT, 3, '0'),
  "owner"."id",
  "sheetRows"."customerName",
  "sheetRows"."email",
  "sheetRows"."recipientName",
  "sheetRows"."personCount",
  CASE WHEN "sheetRows"."deliveryAddress" IS NULL THEN 'Korábbi nyilvántartás' ELSE 'Per Post' END,
  "sheetRows"."deliveryAddress",
  "sheetRows"."message",
  "sheetRows"."delivered",
  "sheetRows"."paid",
  "sheetRows"."amountCents",
  "sheetRows"."photographed",
  "sheetRows"."invoiceNumber",
  'irismoment-gift-sheet-2025-row-' || "sheetRows"."sourceOrder"::TEXT,
  "sheetRows"."sourceOrder",
  'Google Sheets – Geschenkkarten 2025',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "sheetRows"
CROSS JOIN "owner"
ON CONFLICT ("externalId") DO NOTHING;
