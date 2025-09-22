use std::fs;
use std::io::{self, BufRead};

#[derive(Clone)]
pub struct Targetlist {
    pub addresses: Vec<String>,
}

impl Targetlist {
    pub fn new(file_path: &str) -> io::Result<Self> {
        let mut addresses = Vec::new();

        let file = fs::File::open(file_path)?;
        let reader = io::BufReader::new(file);

        for line in reader.lines() {
            let line = line?;
            addresses.push(line);
        }

        Ok(Targetlist { addresses })
    }

    pub fn empty() -> Self {
        let addresses = Vec::<String>::new();
        Targetlist { addresses }
    }

    pub fn length(self) -> usize {
        self.addresses.len()
    }

    // Check if an address is in the Targetlist
    pub fn is_listed_on_target(&self, address: &str) -> bool {
        self.addresses.contains(&address.to_string())
    }
}
