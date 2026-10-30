-- Bật RLS và không tạo policy: vai trò anon/authenticated của Supabase (PostgREST) không truy cập được bảng nào.
-- Server Node kết nối bằng vai trò postgres nên bỏ qua RLS.
ALTER TABLE public."Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Realm" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GameMap" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Character" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Currency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CharacterCurrency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MonsterType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MonsterDrop" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."InventoryItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Guild" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Equipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Friend" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Block" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CharacterSkill" ENABLE ROW LEVEL SECURITY;
