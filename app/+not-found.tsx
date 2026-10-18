import { Redirect } from 'expo-router';

/** Unknown URLs (e.g. /nope) go home instead of showing Expo's "Unmatched Route" page. */
export default function NotFound() {
  return <Redirect href="/" />;
}
