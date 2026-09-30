import { useCallback, useEffect, useState } from "react";
import { CART_STORAGE_KEY, normalizeCart, type CartLine } from "@/lib/shop";

/**
 * Panier de la boutique, gardé dans le navigateur (aucune donnée personnelle).
 * Partagé entre les onglets et entre l'en-tête et les pages par un événement.
 * Stockage indisponible (navigation privée stricte) : le panier vit le temps de la page.
 */
const EVENT = "cds-panier";
let memory: CartLine[] = [];

function read(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    return raw ? normalizeCart(JSON.parse(raw)) : [];
  } catch {
    return memory;
  }
}

function write(cart: CartLine[]) {
  memory = cart;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    /* stockage indisponible : panier en mémoire */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useCart() {
  // Vide au rendu serveur et à l'hydratation, puis relu dans le navigateur.
  const [cart, setCart] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setCart(read());
    sync();
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) sync();
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = useCallback((next: (current: CartLine[]) => CartLine[]) => {
    write(normalizeCart(next(read())));
  }, []);

  const count = cart.reduce((sum, l) => sum + l.quantity, 0);
  return { cart, ready, count, update, clear: () => write([]) };
}
