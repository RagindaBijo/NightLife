import FollowList from '../../../../components/FollowList';

/** People the account follows (yours unless userId is given). */
export default function Following({ userId }) {
  return <FollowList kind="following" userId={userId} />;
}
