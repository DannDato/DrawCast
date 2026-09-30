import { useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { getLoadingSnapshot, subscribeLoading } from '../../utils/loading';
import LoadingOverlay from './LoadingOverlay';

export default function GlobalLoadingOverlay() {
  const { pathname } = useLocation();
  const { active, message } = useSyncExternalStore(subscribeLoading, getLoadingSnapshot);

  if (pathname.startsWith('/overlay/')) return null;

  return <LoadingOverlay active={active} message={message} />;
}
