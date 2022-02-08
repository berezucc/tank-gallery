<?php
if (isset($_POST['Email'])) {
    $email_from = "jerkmoneymen@gmail.com";
    $email_subject = "Contact form submissions";
    $email_to = "nikita@cntechmodel.biz";

    function problem($error)
    {
        echo "We're sorry, but there were error(s) found with the form you submitted. ";
        echo "These errors appear below.<br><br>";
        echo $error . "<br><br>";
        echo "Please go back and fix these errors.<br><br>";
        die();
    }

    // validation expected data exists
    if (
        !isset($_POST['Name']);
        !isset($_POST['Email']);
        !isset($_POST['Phone ']);
        !isset($_POST['Subject']);
    ) {
        problem('We are sorry, but there appears to be a problem with the form you submitted.');
    }

    $name = $_POST['Name']; 
    $email = $_POST['Email']; 
    $phone = $_POST['Phone']; 
    $subject = $_POST['Subject']; 

    $error_subject = "";
    $email_exp = '/^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$/';

    if (!preg_match($email_exp, $email)) {
        $error_subject .= 'The Email address you entered does not appear to be valid.<br>';
    }

    $string_exp = "/^[A-Za-z .'-]+$/";

    if (!preg_match($string_exp, $name)) {
        $error_subject .= 'The Name you entered does not appear to be valid.<br>';
    }

    $phone_exp = "/^[0-9-]$/"

    if (!preg_match( ,$phone)){
        $error_subject .= 'The Phone Number you entered does not appear to be valid.<br>';
    }

    if (strlen($subject) < 2) {
        $error_subject .= 'The Subject you entered do not appear to be valid.<br>';
    }

    if (strlen($error_subject) > 0) {
        problem($error_subject);
    }

    $email_subject = "Form details below.\n\n";

    function clean_string($string)
    {
        $bad = array("content-type", "bcc:", "to:", "cc:", "href");
        return str_replace($bad, "", $string);
    }

    $email_subject .= "Name: " . clean_string($name) . "\n";
    $email_subject .= "Email: " . clean_string($email) . "\n";
    $email_subject .= "Phone Number: " . clean_string($phone) . "\n";
    $email_subject .= "Subject: " . clean_string($subject) . "\n";

    // create email headers
    $headers = 'From: ' . $email . "\r\n" .
        'Reply-To: ' . $email . "\r\n" .
        'X-Mailer: PHP/' . phpversion();
    mail($email_to, $email_subject, $email_subject, $headers);
?>

    //Thanks for contacting me. We will get in touch soon.

<?php
}
?>