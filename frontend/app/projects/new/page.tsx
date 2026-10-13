import { ProjectForm } from "../../../components/ProjectForm";

export default function NewProjectPage() {
  return (
    <div>
      <p className="kicker">New entry</p>
      <h1>New project</h1>
      <div className="card"><ProjectForm /></div>
    </div>
  );
}
