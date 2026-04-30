module shelby::registry {
    use std::string::String;
    use std::vector;
    use std::signer;
    use aptos_framework::account;
    use aptos_framework::event;
    use aptos_framework::timestamp;

    struct Project has store, drop {
        name: String,
        content_hash: String,
        timestamp: u64,
    }

    struct Registry has key {
        projects: vector<Project>,
    }

    #[event]
    struct ProjectRegisteredEvent has drop, store {
        owner: address,
        name: String,
        content_hash: String,
        timestamp: u64,
    }

    public entry fun initialize(account: &signer) {
        if (!exists<Registry>(signer::address_of(account))) {
            move_to(account, Registry { projects: vector::empty() });
        }
    }

    public entry fun register_project(account: &signer, name: String, content_hash: String) acquires Registry {
        let owner_addr = signer::address_of(account);

        if (!exists<Registry>(owner_addr)) {
            move_to(account, Registry { projects: vector::empty() });
        };

        let registry = borrow_global_mut<Registry>(owner_addr);
        let current_time = timestamp::now_seconds();

        let new_project = Project {
            name,
            content_hash,
            timestamp: current_time,
        };

        std::vector::push_back(&mut registry.projects, new_project);

        event::emit(ProjectRegisteredEvent {
            owner: owner_addr,
            name,
            content_hash,
            timestamp: current_time,
        });
    }
}
