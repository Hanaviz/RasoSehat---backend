-- Add tsvector column and GIN index for full-text search on menu_makanan
ALTER TABLE IF EXISTS menu_makanan ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate existing rows (include diet claims and bahan baku text columns)
UPDATE menu_makanan SET search_vector = to_tsvector('simple', coalesce(nama_menu,'') || ' ' || coalesce(deskripsi,'') || ' ' || coalesce(diet_claims_old,'') || ' ' || coalesce(bahan_baku_old,'')) WHERE search_vector IS NULL;

-- Create GIN index
CREATE INDEX IF NOT EXISTS menu_search_gin ON menu_makanan USING GIN(search_vector);

-- Trigger function to keep search_vector up to date
CREATE OR REPLACE FUNCTION menu_makanan_search_vector_trigger() RETURNS trigger AS $$
begin
  new.search_vector := to_tsvector('simple', coalesce(new.nama_menu,'') || ' ' || coalesce(new.deskripsi,'') || ' ' || coalesce(new.diet_claims_old,'') || ' ' || coalesce(new.bahan_baku_old,''));
  return new;
end
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS tsvectorupdate_menu_makanan ON menu_makanan;
CREATE TRIGGER tsvectorupdate_menu_makanan BEFORE INSERT OR UPDATE
    ON menu_makanan FOR EACH ROW EXECUTE PROCEDURE menu_makanan_search_vector_trigger();

-- Helper SQL function to perform ranked search. Returns menu_makanan rows ordered by rank.
CREATE OR REPLACE FUNCTION menu_search(query text, lim int DEFAULT 20)
RETURNS SETOF menu_makanan AS $$
BEGIN
  RETURN QUERY
  SELECT m.*
  FROM menu_makanan m
  WHERE m.search_vector @@ plainto_tsquery('simple', query)
    AND m.status_verifikasi = 'disetujui'
  ORDER BY ts_rank(m.search_vector, plainto_tsquery('simple', query)) DESC, m.updated_at DESC
  LIMIT COALESCE(lim, 20);
END;
$$ LANGUAGE plpgsql;
