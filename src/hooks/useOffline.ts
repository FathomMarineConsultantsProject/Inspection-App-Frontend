import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useCallback, useEffect, useMemo, useState } from "react";

function computeIsOffline(state: NetInfoState): boolean {
  return !state.isConnected;
}

export default function useOffline() {
  const [isOffline, setIsOffline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    let active = true;

    const apply = (state: NetInfoState) => {
      console.log("NETWORK STATUS:", state.isConnected);
      if (active) {
        setIsOffline(computeIsOffline(state));
      }
    };

    const unsubscribe = NetInfo.addEventListener(apply);

    void NetInfo.fetch().then((state) => {
      apply(state);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isOffline) {
      setWasOffline(true);
    }
  }, [isOffline]);

  const isBackOnline = useMemo(() => !isOffline && wasOffline, [isOffline, wasOffline]);

  const resetWasOffline = useCallback(() => {
    setWasOffline(false);
  }, []);

  return { isOffline, isBackOnline, resetWasOffline };
}
