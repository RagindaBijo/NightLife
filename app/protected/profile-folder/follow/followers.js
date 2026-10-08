import FollowList from '../../../../components/FollowList';

/** People following the account (yours unless userId is given). */
export default function Followers({ userId }) {
  return <FollowList kind="followers" userId={userId} />;
}
