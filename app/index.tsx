import HomeA from '../components/home/HomeA';
import HomeB from '../components/home/HomeB';
import HomeC from '../components/home/HomeC';
import HomeCA from '../components/home/HomeCA';
import HomeCB from '../components/home/HomeCB';
import { getHomeVariant } from '../components/home/variant';

/** Home page: `?home=a|b|c|ca|cb` picks the design (default a); all share components/home/useHomeForm.ts. */
export default function Home() {
  switch (getHomeVariant()) {
    case 'b':
      return <HomeB />;
    case 'c':
      return <HomeC />;
    case 'ca':
      return <HomeCA />;
    case 'cb':
      return <HomeCB />;
    default:
      return <HomeA />;
  }
}
