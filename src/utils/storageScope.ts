import AsyncStorage from "@react-native-async-storage/async-storage";

export function getUserScopedKey(baseKey: string, userId: string | undefined | null) {
  if (!userId) return baseKey;
  return `${baseKey}_${userId}`;
}

export async function loadScopedInspectionsWithMigration(
  userId: string | undefined | null,
): Promise<{ key: string; data: string | null }> {
  const scopedKey = getUserScopedKey("inspections", userId);
  let data = await AsyncStorage.getItem(scopedKey);

  if (!data && scopedKey !== "inspections") {
    const oldData = await AsyncStorage.getItem("inspections");
    if (oldData) {
      await AsyncStorage.setItem(scopedKey, oldData);
      await AsyncStorage.removeItem("inspections");
      data = oldData;
    }
  }

  return { key: scopedKey, data };
}
