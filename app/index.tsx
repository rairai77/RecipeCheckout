import HomeA from '../components/home/HomeA';
import HomeB from '../components/home/HomeB';
import HomeC from '../components/home/HomeC';
import { getHomeVariant } from '../components/home/variant';

/** Home page: `?home=a|b|c` picks the design (default a); all share components/home/useHomeForm.ts. */
export default function Home() {
  const v = getHomeVariant();
  return v === 'b' ? <HomeB /> : v === 'c' ? <HomeC /> : <HomeA />;
}
