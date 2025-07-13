-- ストレージバケット作成
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pdf-files', 'pdf-files', true);

-- パブリックアクセスポリシー設定
CREATE POLICY "Public Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'pdf-files');

-- アップロードポリシー設定
CREATE POLICY "Authenticated Upload" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'pdf-files');

-- 更新ポリシー設定
CREATE POLICY "Authenticated Update" ON storage.objects 
FOR UPDATE WITH CHECK (bucket_id = 'pdf-files');

-- 削除ポリシー設定
CREATE POLICY "Authenticated Delete" ON storage.objects 
FOR DELETE USING (bucket_id = 'pdf-files');
