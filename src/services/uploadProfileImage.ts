import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

export async function uploadProfileImage(
  uri: string,
  userId: string
): Promise<string | null> {
  try {
    console.log("Uploading image:", uri);

    const response = await fetch(uri);
    const blob = await response.blob();

    const fileExt = uri.split(".").pop() || "jpg";
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error } = await supabase.storage
      .from("profile-images")
      .upload(filePath, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) {
      console.log("UPLOAD ERROR:", error);
      return null;
    }

    const { data } = supabase.storage
      .from("profile-images")
      .getPublicUrl(filePath);

    console.log("FINAL IMAGE URI:", data.publicUrl);

    return data.publicUrl;
  } catch (err) {
    console.log("UPLOAD CRASH:", err);
    return null;
  }
}

export default uploadProfileImage;
