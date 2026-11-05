import { useLocation, useNavigate } from "react-router-dom";
import { usePageBack } from "./back";

/** The previous page, or fallback when the app was opened directly on this one. */
export function useGoBack(fallback = "/") {
  const navigate = useNavigate();
  return () => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };
}

/**
 * Page back for every route. Browse with no search is the first page, where
 * Eitaa shows close; anywhere else back goes the way it came, or to Browse.
 */
export function useRouteBack() {
  const { pathname, search } = useLocation();
  const goBack = useGoBack("/");
  usePageBack(pathname === "/" && !search ? undefined : goBack);
}
