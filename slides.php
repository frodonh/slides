<?php
require 'login.php';

if (array_key_exists('push',$_POST))	{	// Master mode, updates database with new hash
	$dbconn=pg_connect("host=".$host." dbname=".$dbname." user=".$user." password=".$password) or die ('Impossible to connect to the database: '.pg_last_error());
	if (!pg_meta_data($dbconn,'slides')) {
		$query="create table slides (name varchar(30) primary key, hash varchar(50), interactive text)";
		$result=pg_query($query) or die('Request failed: '.pg_last_error());
		pg_free_result($result);
		$query="create or replace function notify_slides() returns trigger as $$
			begin
				perform pg_notify(old.name,new.hash);
				return new;
			end;
			$$ language plpgsql;";
		$result=pg_query($query) or die('Request failed: '.pg_last_error());
		pg_free_result($result);
		$query="create trigger notify_update after update on slides for each row execute procedure notify_slides()";
		$result=pg_query($query) or die('Request failed: '.pg_last_error());
		pg_free_result($result);
	}
	if (!array_key_exists('interactive', $_POST)) $_POST["interactive"]="";
	$query="insert into slides values ('".$_POST['push']."','".$_POST['hash']."','".$_POST['interactive']."') on conflict(name) do update set hash=EXCLUDED.hash, interactive=EXCLUDED.interactive";
	$result=pg_query($query) or die('Request failed: '.pg_last_error());
	pg_free_result($result);
	pg_close($dbconn);
} elseif (array_key_exists('register',$_GET)) {	// Slave mode with HTML5 server-sent events, connection kept alive, changes in database are immediatly sent to client
	$dbconn=pg_connect("host=".$host." dbname=".$dbname." user=".$user." password=".$password) or die ('Impossible to connect to the database: '.pg_last_error());
	header('Content-Type: text/event-stream');
	header('Cache-Control: no-cache');
	ob_end_clean();
	$query='listen "'.$_GET['register'].'"';
	$result=pg_query($query) or die('Request failed: '.pg_last_error());
	register_shutdown_function(function($dbconn,$result) {
		pg_free_result($result);
		pg_close($dbconn);
	},$dbconn,$result);
	do {
		$notify=pg_get_notify($dbconn,PGSQL_ASSOC);
		if ($notify) {
			echo 'data: '.$notify['payload'].PHP_EOL;
			echo PHP_EOL;
			flush();
		}
		sleep(1);
	} while (true);
	pg_free_result($result);
	pg_close($dbconn);
} elseif (array_key_exists('pull',$_POST)) {	// Slave mode with no HTML5 server-sent events, client has to poll at regular intervals
	$dbconn=pg_connect("host=".$host." dbname=".$dbname." user=".$user." password=".$password) or die ('Impossible to connect to the database: '.pg_last_error());
	$query="select hash from slides where name='".$_POST['pull']."'";
	$result=pg_query($query) or die('Request failed: '.pg_last_error());
	$val=pg_fetch_array($result,null,PGSQL_ASSOC);
	if ($val) echo $val['hash'];
	pg_free_result($result);
	pg_close($dbconn);
} elseif (array_key_exists('wait', $_REQUEST)) {	// Goes into waiting mode for interactive slideshows
	echo <<<END
	<!DOCTYPE html>
	<html>
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
	END;
	if (array_key_exists('css', $_REQUEST)) echo '<link rel="stylesheet" href="'.$_REQUEST["css"].'">';
	echo <<<END
		<script src="sync.js"></script>
	</head>
	<body>
	</body>
	</html>
	END;
} elseif (array_key_exists('subscribe', $_REQUEST)) {	// Subscribe to server-sent events for new polls
	$dbconn=pg_connect("host=".$host." dbname=".$dbname." user=".$user." password=".$password) or die ('Impossible to connect to the database: '.pg_last_error());
	header('Content-Type: text/event-stream');
	header('Cache-Control: no-cache');
	ob_end_clean();
	$query='listen "'.$_REQUEST['subscribe'].'"';
	$result=pg_query($query) or die('Request failed: '.pg_last_error());
	register_shutdown_function(function($dbconn,$result) {
		pg_free_result($result);
		pg_close($dbconn);
	},$dbconn,$result);
	do {
		$notify=pg_get_notify($dbconn,PGSQL_NUM);
		if ($notify) {
			$query="select interactive from slides where name='".$_REQUEST['subscribe']."'";
			$res=pg_query($query) or die('Request failed: '.pg_last_error());
			$val=pg_fetch_array($res,null,PGSQL_ASSOC);
			pg_free_result($res);
			if ($val) {
				$arr = explode("\n", $val['interactive']);
				foreach ($arr as $line) echo 'data: '.$line.PHP_EOL;
				echo PHP_EOL;
				flush();
			}
		}
		sleep(1);
	} while (true);
	pg_free_result($result);
	pg_close($dbconn);
} elseif (array_key_exists('submit', $_REQUEST)) {	// Submit an answer to a poll
	$dbconn=pg_connect("host=".$host." dbname=".$dbname." user=".$user." password=".$password) or die ('Impossible to connect to the database: '.pg_last_error());
	if (!pg_meta_data($dbconn,'polls')) {
		$query="create table polls (name varchar(30), question text, answer text)";
		$result=pg_query($query) or die('Request failed: '.pg_last_error());
		pg_free_result($result);
		$query="create or replace function notify_polls() returns trigger as $$
			begin
				perform pg_notify(new.question,new.answer);
				return new;
			end;
			$$ language plpgsql;";
		$result=pg_query($query) or die('Request failed: '.pg_last_error());
		pg_free_result($result);
		$query="create trigger notify_update after insert on polls for each row execute procedure notify_polls()";
		$result=pg_query($query) or die('Request failed: '.pg_last_error());
		pg_free_result($result);
	}
	$query="insert into polls values ('".$_POST['submit']."','".$_POST['poll']."','".$_POST['answer']."')";
	$result=pg_query($query) or die('Request failed: '.pg_last_error());
	pg_free_result($result);
	pg_close($dbconn);
}
?>
