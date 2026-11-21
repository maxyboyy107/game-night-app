import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useUser } from '@clerk/react';
import { getGameNight, listGameNights } from '@workspace/api-client-react';
import type { GameNightDetail, GameNightInvitation, GameNightSummary } from '@workspace/api-client-react';

const ACTIVE_GAME_NIGHT_KEY = 'games-io.active-game-night.v1';

type GameNightContextValue = {
  gameNights: GameNightSummary[];
  invitations: GameNightInvitation[];
  selectedId: string;
  selected: GameNightDetail | undefined;
  loading: boolean;
  error: string;
  selectGameNight: (id: string) => Promise<void>;
  refreshGameNights: (preferredId?: string) => Promise<void>;
};

const GameNightContext = createContext<GameNightContextValue | null>(null);

export function GameNightProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  const userId = user?.id;
  const [gameNights, setGameNights] = useState<GameNightSummary[]>([]);
  const [invitations, setInvitations] = useState<GameNightInvitation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selected, setSelected] = useState<GameNightDetail>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const refreshGameNights = useCallback(async (preferredId?: string) => {
    const version = ++requestVersion.current;
    if (!userId) {
      setGameNights([]);
      setInvitations([]);
      setSelectedId('');
      setSelected(undefined);
      setLoading(false);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await listGameNights();
      if (version !== requestVersion.current) return;
      setGameNights(result.gameNights);
      setInvitations(result.invitations);
      let rememberedId = preferredId || selectedIdRef.current;
      if (!rememberedId) {
        try { rememberedId = window.localStorage.getItem(ACTIVE_GAME_NIGHT_KEY) || ''; } catch { rememberedId = ''; }
      }
      const nextId = result.gameNights.some((night) => night.id === rememberedId)
        ? rememberedId
        : result.gameNights[0]?.id || '';
      setSelectedId(nextId);
      try {
        if (nextId) window.localStorage.setItem(ACTIVE_GAME_NIGHT_KEY, nextId);
        else window.localStorage.removeItem(ACTIVE_GAME_NIGHT_KEY);
      } catch { /* Group selection still works for this session. */ }
      if (!nextId) {
        setSelected(undefined);
        return;
      }
      const detail = await getGameNight(nextId);
      if (version === requestVersion.current) setSelected(detail);
    } catch {
      if (version === requestVersion.current) setError('Game Nights could not be loaded. Try again.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [userId]);

  const selectGameNight = useCallback(async (id: string) => {
    const version = ++requestVersion.current;
    setSelectedId(id);
    setError('');
    try { window.localStorage.setItem(ACTIVE_GAME_NIGHT_KEY, id); } catch { /* Selection remains in memory. */ }
    if (!id) {
      setSelected(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const detail = await getGameNight(id);
      if (version === requestVersion.current) setSelected(detail);
    } catch {
      if (version === requestVersion.current) {
        setSelected(undefined);
        setError('This Game Night could not be opened. Check your membership and try again.');
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    void refreshGameNights();
    return () => { requestVersion.current += 1; };
  }, [isLoaded, userId, refreshGameNights]);

  const value = useMemo(() => ({
    gameNights,
    invitations,
    selectedId,
    selected,
    loading,
    error,
    selectGameNight,
    refreshGameNights,
  }), [gameNights, invitations, selectedId, selected, loading, error, selectGameNight, refreshGameNights]);

  return <GameNightContext.Provider value={value}>{children}</GameNightContext.Provider>;
}

export function useGameNight() {
  const value = useContext(GameNightContext);
  if (!value) throw new Error('useGameNight must be used within GameNightProvider.');
  return value;
}
