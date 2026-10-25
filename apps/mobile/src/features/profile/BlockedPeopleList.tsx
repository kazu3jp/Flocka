import { Btn, C, Panel, T } from "../../components/ui";

export type BlockedPerson = { id: string; name: string };

/** People the user blocked, each with an unblock button. Confirmation is the caller's. */
export function BlockedPeopleList({
  people,
  busy,
  activeId,
  onUnblock,
}: {
  people: BlockedPerson[];
  busy: boolean;
  /** The person whose unblock request is running, if any. */
  activeId: string | null;
  onUnblock: (person: BlockedPerson) => void;
}) {
  if (!people.length)
    return (
      <Panel>
        <T size={13} color={C.muted}>
          ブロックしている人はいません。
        </T>
      </Panel>
    );
  return (
    <>
      {people.map((person) => (
        <Btn
          key={person.id}
          plain
          label={`${person.name}のブロックを解除`}
          loading={activeId === person.id}
          disabled={busy}
          onPress={() => onUnblock(person)}
        />
      ))}
    </>
  );
}
