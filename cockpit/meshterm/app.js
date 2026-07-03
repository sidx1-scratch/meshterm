const state = {
  computers: [],
  mode: "meshterm"
};
const elements = {
  status: document.querySelector("#status"),
  target: document.querySelector("#target"),
  command: document.querySelector("#command"),
  run: document.querySelector("#run"),
  refresh: document.querySelector("#refresh"),
  machines: document.querySelector("#machines"),
  output: document.querySelector("#output"),
  clear: document.querySelector("#clear")
};

function appendOutput(text) {
  elements.output.textContent += text;
  elements.output.scrollTop = elements.output.scrollHeight;
}

function setStatus(text) {
  elements.status.textContent = text;
}

function renderComputers() {
  elements.target.replaceChildren();
  elements.machines.replaceChildren();

  if (state.mode === "meshterm") {
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = "all";
    elements.target.append(all);
  }

  for (const computer of state.computers) {
    const option = document.createElement("option");
    option.value = computer.name;
    option.textContent = computer.name;
    elements.target.append(option);

    const item = document.createElement("article");
    item.className = "machine";
    const title = document.createElement("h3");
    title.textContent = computer.name;
    const destination = document.createElement("p");
    destination.textContent = computer.destination;
    const meta = document.createElement("small");
    const tags = Array.isArray(computer.tags) && computer.tags.length > 0 ? computer.tags.join(", ") : "no tags";
    meta.textContent = `port ${computer.port} - ${tags}`;
    item.append(title, destination, meta);
    elements.machines.append(item);
  }

  if (state.computers.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No computers configured yet. Add one with meshterm add on this host.";
    elements.machines.append(empty);
  }
}

async function loadComputers() {
  setStatus("Loading configured computers...");
  try {
    const text = await cockpit.spawn(["meshterm", "list", "--json"], { err: "message" });
    state.mode = "meshterm";
    state.computers = JSON.parse(text || "[]");
    renderComputers();
    setStatus(`${state.computers.length} configured computer${state.computers.length === 1 ? "" : "s"}`);
  } catch (error) {
    state.mode = "local";
    state.computers = [{ name: "this-host", destination: "Cockpit host", port: "-", tags: ["local"] }];
    renderComputers();
    setStatus("MeshTerminal CLI is not available here. Commands will run on this Cockpit host.");
    appendOutput(`${error.message || error}\n`);
  }
}

async function runCommand() {
  const target = elements.target.value;
  const command = elements.command.value.trim();
  if (!target || !command) return;

  elements.run.disabled = true;
  appendOutput(state.mode === "meshterm" ? `$ meshterm run ${target} ${command}\n` : `$ ${command}\n`);
  try {
    const args = state.mode === "meshterm" ? ["meshterm", "run", target, command] : ["sh", "-lc", command];
    const channel = cockpit.spawn(args, { err: "out" });
    channel.stream((data) => appendOutput(data));
    await channel;
    appendOutput("\n");
  } catch (error) {
    appendOutput(`${error.message || error}\n`);
  } finally {
    elements.run.disabled = false;
    elements.command.focus();
  }
}

elements.refresh.addEventListener("click", loadComputers);
elements.clear.addEventListener("click", () => { elements.output.textContent = ""; });
elements.run.addEventListener("click", runCommand);
elements.command.addEventListener("keydown", (event) => {
  if (event.key === "Enter") runCommand();
});

loadComputers();
