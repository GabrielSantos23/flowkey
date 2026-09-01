fn main() {
    let subject_alt_names = vec!["LocalSend User".to_string()];
    let cert = rcgen::generate_simple_self_signed(subject_alt_names).unwrap();
    let cert_der = cert.cert.der();
}
