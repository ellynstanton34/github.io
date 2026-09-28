import { basisLabel } from "@/lib/labels";

type VictimDefaults = {
  name?: string;
  bornOn?: string;
  diedOn?: string;
  hometown?: string | null;
  profile?: string;
  profileBasis?: string;
  photoUrl?: string | null;
  photoCredit?: string | null;
};

// Shared by "new case" and "edit victim".
export function VictimFields({ nameField = "name", v = {} }: { nameField?: string; v?: VictimDefaults }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label">Name</label>
        <input name={nameField} required className="input" defaultValue={v.name} />
      </div>
      <div>
        <label className="label">Born</label>
        <input name="bornOn" type="date" className="input" defaultValue={v.bornOn} />
      </div>
      <div>
        <label className="label">Died or went missing</label>
        <input name="diedOn" type="date" className="input" defaultValue={v.diedOn} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Hometown</label>
        <input name="hometown" className="input" defaultValue={v.hometown ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Who they were</label>
        <p className="muted mb-2">
          Their life, not their death. What they loved, what they did, how the people close to them remember them.
        </p>
        <textarea name="profile" required rows={6} className="input" defaultValue={v.profile} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Where this profile comes from</label>
        <select name="profileBasis" required className="input" defaultValue={v.profileBasis ?? ""}>
          <option value="" disabled>Choose one</option>
          {Object.entries(basisLabel).map(([value, text]) => (
            <option key={value} value={value}>{text}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Photo URL (optional)</label>
        <input name="photoUrl" className="input" defaultValue={v.photoUrl ?? ""} />
      </div>
      <div>
        <label className="label">Photo credit</label>
        <input name="photoCredit" className="input" placeholder="e.g. Courtesy of the family" defaultValue={v.photoCredit ?? ""} />
      </div>
    </div>
  );
}
