import { supabase } from "../supabaseClient";

export async function uploadProfileImage(
  uri: string,
  userId: string,
  oldUrl?: string | null
): Promise<string> {
  try {
    console.log("Uploading image:", uri);

    // Prevent re-upload of already uploaded images
    if (uri.startsWith("http")) return uri;

    const fileExt = uri.split(".").pop() || "jpg";
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const formData = new FormData();

    formData.append("file", {
      uri,
      name: fileName,
      type: `image/${fileExt}`,
    } as any);

    const { error } = await supabase.storage
      .from("profile-images")
      .upload(filePath, formData, {
        upsert: true,
      });

    if (error) {
      console.log("UPLOAD ERROR:", error);
      throw error;
    }

    const { data } = supabase.storage
      .from("profile-images")
      .getPublicUrl(filePath);

    console.log("FINAL IMAGE URI:", data.publicUrl);
    console.log("UPLOAD COMPLETED SUCCESSFULLY");

    return data.publicUrl;
  } catch (err) {
    console.log("UPLOAD FAILED:", err);
    throw err;
  }
}

export default uploadProfileImage;
